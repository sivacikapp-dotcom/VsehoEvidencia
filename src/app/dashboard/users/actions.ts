"use server"

import { revalidatePath } from "next/cache"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { hashPassword, verifyPassword } from "@/lib/password"
import type { Role } from "@/generated/prisma/enums"
import { createAuditLog } from "@/lib/auditLog"

type Result = { error?: string; success?: boolean; errors?: string[] }

const PASSWORD_POLICY = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{10,}$/
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
// username: písmená, číslice, podčiarkovník, bodka, pomlčka; 2-50 znakov
const USERNAME_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9_.-]{1,49}$/

const MIN_ACTIVE_ADMINS = 2

function validatePassword(password: string): string | null {
  if (!password || password.length < 10) return "Heslo musí mať aspoň 10 znakov."
  if (!PASSWORD_POLICY.test(password))
    return "Heslo musí obsahovať aspoň jedno malé písmeno, jedno veľké písmeno a jednu číslicu."
  return null
}

function getCallerUsername(session: Awaited<ReturnType<typeof getServerSession<typeof authOptions>>>): string | null {
  return session?.user?.username ?? null
}

/**
 * Odošle mustAcknowledge notifikáciu všetkým ostatným aktívnym správcom aplikácie.
 * Volá sa pri zmene hesla alebo zmene role SPRAVCA_APLIKACIE.
 */
async function notifyOtherAdmins(
  excludeUserId: number,
  type: "ADMIN_PASSWORD_CHANGED" | "ADMIN_ROLE_CHANGED",
  title: string,
  message: string
) {
  const otherAdmins = await prisma.user.findMany({
    where: {
      roles: { has: "SPRAVCA_APLIKACIE" },
      isAdminAccount: true,
      lockedUntil: null,
      id: { not: excludeUserId },
    },
    select: { id: true },
  })
  if (otherAdmins.length === 0) return

  await prisma.notification.createMany({
    data: otherAdmins.map((u) => ({
      userId: u.id,
      type,
      title,
      message,
      mustAcknowledge: true,
    })),
  })
}

/**
 * Vráti počet aktívnych (nezablokovaných) správcov aplikácie.
 */
async function countActiveAdmins(): Promise<number> {
  return prisma.user.count({
    where: {
      roles: { has: "SPRAVCA_APLIKACIE" },
      isAdminAccount: true,
      OR: [{ lockedUntil: null }, { lockedUntil: { lt: new Date() } }],
    },
  })
}

export async function createUser(formData: FormData): Promise<Result> {
  const session = await getServerSession(authOptions)
  if (!session?.user?.roles.includes("SPRAVCA_APLIKACIE")) {
    return { error: "Nemáte oprávnenie vytvárať používateľov." }
  }

  const username = (formData.get("username") as string)?.trim().toLowerCase()
  if (!username) return { error: "Používateľské meno je povinné." }
  if (!USERNAME_PATTERN.test(username))
    return { error: "Používateľské meno môže obsahovať písmená, číslice, podčiarkovník, bodku a pomlčku (2–50 znakov)." }

  const firstName = (formData.get("firstName") as string)?.trim()
  const lastName = (formData.get("lastName") as string)?.trim()
  if (!firstName) return { error: "Meno je povinné." }
  if (!lastName) return { error: "Priezvisko je povinné." }
  if (firstName.length > 100 || lastName.length > 100)
    return { error: "Meno alebo priezvisko je príliš dlhé." }

  const email = (formData.get("email") as string)?.trim().toLowerCase()
  if (!email || !EMAIL_PATTERN.test(email))
    return { error: "Zadajte platnú e-mailovú adresu." }

  const password = (formData.get("password") as string)?.trim()
  const passwordError = validatePassword(password)
  if (passwordError) return { error: passwordError }

  const existingUsername = await prisma.user.findUnique({ where: { username } })
  if (existingUsername) return { error: `Používateľské meno „${username}" je už obsadené.` }

  const rolesRaw = formData.getAll("roles") as string[]
  const roles = rolesRaw.filter(Boolean) as Role[]
  if (roles.length === 0) return { error: "Vyberte aspoň jednu rolu." }

  const isAdminAccount = roles.includes("SPRAVCA_APLIKACIE") && roles.length === 1
  const isAdminRaw = formData.get("isAdminAccount") === "true"

  // Admin účet smie mať LEN rolu SPRAVCA_APLIKACIE
  if (isAdminRaw && roles.some((r) => r !== "SPRAVCA_APLIKACIE")) {
    return { error: "Administrátorský účet môže mať výhradne rolu Správca aplikácie." }
  }
  // Bežný účet nesmie mať rolu SPRAVCA_APLIKACIE
  if (!isAdminRaw && roles.includes("SPRAVCA_APLIKACIE")) {
    return { error: "Rolu Správca aplikácie možno priradiť iba administrátorskému účtu (admin.xxx)." }
  }

  const supervisorIdRaw = formData.get("supervisorId") as string
  const supervisorId = supervisorIdRaw ? parseInt(supervisorIdRaw) : null

  const linkedUserIdRaw = formData.get("linkedUserId") as string
  const linkedUserId = linkedUserIdRaw ? parseInt(linkedUserIdRaw) : null

  // Ak je admin účet prepojený s osobou, firstName/lastName/email sa prevezmú z osoby
  let resolvedFirstName = firstName
  let resolvedLastName = lastName
  let resolvedEmail = email
  if (isAdminRaw && linkedUserId) {
    const linkedPerson = await prisma.user.findUnique({
      where: { id: linkedUserId },
      select: { firstName: true, lastName: true, email: true, isAdminAccount: true },
    })
    if (!linkedPerson || linkedPerson.isAdminAccount) {
      return { error: "Prepojená osoba neexistuje alebo je tiež admin účet." }
    }
    resolvedFirstName = linkedPerson.firstName
    resolvedLastName = linkedPerson.lastName
    resolvedEmail = linkedPerson.email
  }

  try {
    const hash = await hashPassword(password)
    const created = await prisma.user.create({
      data: {
        username,
        firstName: resolvedFirstName,
        lastName: resolvedLastName,
        email: resolvedEmail,
        password: hash,
        roles,
        isAdminAccount: isAdminRaw,
        linkedUserId: linkedUserId || null,
        supervisorId: supervisorId || null,
      },
    })
    await createAuditLog({
      userId: parseInt(session.user.id),
      userEmail: session.user.email,
      userName: session.user.name,
      actorUsername: getCallerUsername(session),
      action: "CREATE",
      entityType: "USER",
      entityId: created.id,
      entityLabel: created.username,
      newData: { username, firstName, lastName, email, roles, isAdminAccount: isAdminRaw, supervisorId: supervisorId || null },
    })

    // Notifikácia ostatným adminom pri vytvorení nového admin účtu
    if (isAdminRaw) {
      await notifyOtherAdmins(
        parseInt(session.user.id),
        "ADMIN_ROLE_CHANGED",
        "Nový administrátorský účet",
        `Správca aplikácie ${getCallerUsername(session) ?? session.user.name} vytvoril nový administrátorský účet „${username}".`
      )
    }

    revalidatePath("/dashboard/users")
    return { success: true }
  } catch {
    return { error: "Nastala chyba pri ukladaní." }
  }
}

export async function updateUser(
  userId: number,
  roles: Role[],
  supervisorId: number | null
): Promise<Result> {
  const session = await getServerSession(authOptions)
  const callerRoles = (session?.user as { roles?: string[] })?.roles ?? []
  if (!session || !callerRoles.includes("SPRAVCA_APLIKACIE")) {
    return { error: "Nemáte oprávnenie upravovať používateľov." }
  }
  if (roles.length === 0) return { error: "Vyberte aspoň jednu rolu." }

  const targetUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { roles: true, supervisorId: true, email: true, username: true, isAdminAccount: true },
  })
  if (!targetUser) return { error: "Používateľ neexistuje." }

  // Admin účet smie mať LEN rolu SPRAVCA_APLIKACIE
  if (targetUser.isAdminAccount && roles.some((r) => r !== "SPRAVCA_APLIKACIE")) {
    return { error: "Administrátorský účet môže mať výhradne rolu Správca aplikácie." }
  }
  // Bežný účet nesmie získať rolu SPRAVCA_APLIKACIE
  if (!targetUser.isAdminAccount && roles.includes("SPRAVCA_APLIKACIE")) {
    return { error: "Rolu Správca aplikácie možno priradiť iba administrátorskému účtu (admin.xxx)." }
  }

  // Pravidlo minimálneho počtu správcov: odoberám SPRAVCA_APLIKACIE?
  const wasAdmin = targetUser.roles.includes("SPRAVCA_APLIKACIE")
  const willBeAdmin = roles.includes("SPRAVCA_APLIKACIE")
  if (wasAdmin && !willBeAdmin) {
    const activeCount = await countActiveAdmins()
    if (activeCount <= MIN_ACTIVE_ADMINS) {
      return {
        error: `Nie je možné odobrať rolu Správca aplikácie — v systéme musia byť vždy aspoň ${MIN_ACTIVE_ADMINS} aktívni správcovia.`,
      }
    }
  }

  const roleChanged = wasAdmin !== willBeAdmin

  try {
    await prisma.user.update({
      where: { id: userId },
      data: { roles, supervisorId },
    })
    await createAuditLog({
      userId: parseInt(session.user.id),
      userEmail: session.user.email,
      userName: session.user.name,
      actorUsername: getCallerUsername(session),
      action: "ROLE_CHANGE",
      entityType: "USER",
      entityId: userId,
      entityLabel: targetUser.username ?? targetUser.email,
      oldData: { roles: targetUser.roles, supervisorId: targetUser.supervisorId },
      newData: { roles, supervisorId },
    })

    // Notifikácia pri zmene role SPRAVCA_APLIKACIE
    if (roleChanged) {
      const action = willBeAdmin ? "pridaná" : "odobraná"
      await notifyOtherAdmins(
        parseInt(session.user.id),
        "ADMIN_ROLE_CHANGED",
        "Zmena role Správca aplikácie",
        `Správca aplikácie ${getCallerUsername(session) ?? session.user.name} ${action} rola Správca aplikácie účtu „${targetUser.username ?? targetUser.email}".`
      )
    }

    revalidatePath("/dashboard/users")
    revalidatePath(`/dashboard/users/${userId}`)
    return { success: true }
  } catch {
    return { error: "Nastala chyba pri ukladaní." }
  }
}

export async function deleteUser(userId: number): Promise<Result> {
  const session = await getServerSession(authOptions)
  const callerRoles = (session?.user as { roles?: string[] })?.roles ?? []
  if (!session || !callerRoles.includes("SPRAVCA_APLIKACIE")) {
    return { error: "Nemáte oprávnenie mazať používateľov." }
  }
  if (parseInt(session.user.id) === userId) {
    return { error: "Nemôžete vymazať vlastný účet." }
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      email: true, username: true, firstName: true, lastName: true,
      roles: true, isAdminAccount: true,
      _count: {
        select: {
          subordinates: true,
          agendaGestors: true,
          documentGestors: true,
        },
      },
    },
  })
  if (!user) return { error: "Používateľ neexistuje." }

  // Paralelne načítame všetky potrebné počty
  const now = new Date()

  function countOtherActiveWithRole(role: Role) {
    return prisma.user.count({
      where: {
        roles: { has: role },
        id: { not: userId },
        OR: [{ lockedUntil: null }, { lockedUntil: { lt: now } }],
      },
    })
  }

  const [
    activeAssets,
    activeAdmins,
    otherSpravcaDok,
    otherSpravcaPC,
    otherSpravcaReg,
    travelOrderCount,
    postaCount,
    zaznamCount,
    spisCount,
  ] = await Promise.all([
    prisma.assetRecipientAssignment.count({ where: { userId, returnedAt: null } }),
    user.roles.includes("SPRAVCA_APLIKACIE") ? countActiveAdmins() : Promise.resolve(999),
    user.roles.includes("SPRAVCA_DOKUMENTOV")    ? countOtherActiveWithRole("SPRAVCA_DOKUMENTOV")    : Promise.resolve(1),
    user.roles.includes("SPRAVCA_PRACOVNYCH_CIEST") ? countOtherActiveWithRole("SPRAVCA_PRACOVNYCH_CIEST") : Promise.resolve(1),
    user.roles.includes("SPRAVCA_REGISTRATURY")  ? countOtherActiveWithRole("SPRAVCA_REGISTRATURY")  : Promise.resolve(1),
    prisma.travelOrder.count({ where: { userId } }),
    prisma.posta.count({ where: { createdById: userId } }),
    prisma.regZaznam.count({ where: { OR: [{ spracovatelId: userId }, { createdById: userId }] } }),
    prisma.spis.count({ where: { OR: [{ spracovatelId: userId }, { createdById: userId }] } }),
  ])

  const errors: string[] = []

  // Správca aplikácie — min. 2 aktívni
  if (user.roles.includes("SPRAVCA_APLIKACIE") && activeAdmins <= MIN_ACTIVE_ADMINS) {
    errors.push(`Správca aplikácie: v systéme musia byť vždy aspoň ${MIN_ACTIVE_ADMINS} aktívni správcovia — najprv priraďte túto rolu niekomu inému.`)
  }

  // Majetok — aktívne priradenia
  if (activeAssets > 0) {
    errors.push(`Evidencia majetku: používateľ má ${activeAssets} aktívne pridelenýc${activeAssets === 1 ? "hý majetok" : "h priradení"} — najprv ich vráťte.`)
  }

  // Nadriadený iných používateľov
  if (user._count.subordinates > 0) {
    errors.push(`Nastavenia: používateľ je nadriadený ${user._count.subordinates} ${user._count.subordinates === 1 ? "používateľa" : "používateľov"} — najprv im zmeňte nadriadeného.`)
  }

  // Gestor agendy
  if (user._count.agendaGestors > 0) {
    errors.push(`Dokumenty: používateľ je gestor ${user._count.agendaGestors} ${user._count.agendaGestors === 1 ? "agendy" : "agend"} — najprv zmeňte gestora.`)
  }

  // Gestor dokumentu
  if (user._count.documentGestors > 0) {
    errors.push(`Dokumenty: používateľ je gestor ${user._count.documentGestors} ${user._count.documentGestors === 1 ? "dokumentu" : "dokumentov"} — najprv zmeňte gestora.`)
  }

  // Jediný správca dokumentov
  if (user.roles.includes("SPRAVCA_DOKUMENTOV") && otherSpravcaDok === 0) {
    errors.push("Dokumenty: používateľ je jediný Správca dokumentov — najprv priraďte túto rolu niekomu inému.")
  }

  // Jediný správca pracovných ciest
  if (user.roles.includes("SPRAVCA_PRACOVNYCH_CIEST") && otherSpravcaPC === 0) {
    errors.push("Pracovné cesty: používateľ je jediný Správca PC — najprv priraďte túto rolu niekomu inému.")
  }

  // Jediný správca registratúry
  if (user.roles.includes("SPRAVCA_REGISTRATURY") && otherSpravcaReg === 0) {
    errors.push("Registratúra: používateľ je jediný Správca registratúry — najprv priraďte túto rolu niekomu inému.")
  }

  // Cestovné príkazy — vlastník
  if (travelOrderCount > 0) {
    errors.push(`Pracovné cesty: používateľ má ${travelOrderCount} ${travelOrderCount === 1 ? "cestovný príkaz" : "cestovných príkazov"} — pred zmazaním ich vyriešte alebo preveďte.`)
  }

  // Podateľňa — záznamy pošty vytvorené týmto používateľom
  if (postaCount > 0) {
    errors.push(`Registratúra: používateľ vytvoril ${postaCount} ${postaCount === 1 ? "záznam pošty" : "záznamy pošty"} — pred zmazaním ich preveďte na iného pracovníka.`)
  }

  // Registratúrne záznamy
  if (zaznamCount > 0) {
    errors.push(`Registratúra: používateľ je spracovateľom alebo autorom ${zaznamCount} ${zaznamCount === 1 ? "záznamu" : "záznamov"} — pred zmazaním ich preveďte.`)
  }

  // Spisy
  if (spisCount > 0) {
    errors.push(`Registratúra: používateľ je spracovateľom alebo autorom ${spisCount} ${spisCount === 1 ? "spisu" : "spisov"} — pred zmazaním ich preveďte.`)
  }

  if (errors.length > 0) {
    return { errors, error: errors.join("\n") }
  }

  try {
    // Odpoj admin účty, ktoré ukazujú na tohto používateľa (FK constraint)
    await prisma.user.updateMany({ where: { linkedUserId: userId }, data: { linkedUserId: null } })
    // Odpoj voliteľné referencie z cestovných príkazov
    await prisma.travelOrder.updateMany({ where: { supervisorId: userId }, data: { supervisorId: null } })
    await prisma.travelOrder.updateMany({ where: { managerId: userId }, data: { managerId: null } })
    // Zmaž notifikácie používateľa (FK bez cascade)
    await prisma.notification.deleteMany({ where: { userId } })
    await prisma.user.delete({ where: { id: userId } })
    await createAuditLog({
      userId: parseInt(session.user.id),
      userEmail: session.user.email,
      userName: session.user.name,
      actorUsername: getCallerUsername(session),
      action: "DELETE",
      entityType: "USER",
      entityId: userId,
      entityLabel: user.username ?? user.email,
      oldData: { username: user.username, email: user.email, firstName: user.firstName, lastName: user.lastName },
    })

    if (user.isAdminAccount) {
      await notifyOtherAdmins(
        parseInt(session.user.id),
        "ADMIN_ROLE_CHANGED",
        "Administrátorský účet vymazaný",
        `Správca aplikácie ${getCallerUsername(session) ?? session.user.name} vymazal administrátorský účet „${user.username ?? user.email}".`
      )
    }

    revalidatePath("/dashboard/users")
    return { success: true }
  } catch (err) {
    console.error("[deleteUser]", err)
    return { error: "Nastala chyba pri mazaní." }
  }
}

export async function changePassword(
  userId: number,
  newPassword: string
): Promise<Result> {
  const session = await getServerSession(authOptions)
  if (!session) return { error: "Nie ste prihlásený." }

  const callerId = parseInt(session.user.id)
  const isSelf = callerId === userId
  const isAdmin = session.user.roles.includes("SPRAVCA_APLIKACIE")

  // Správca aplikácie môže zmeniť heslo sám sebe; ostatní nemôžu meniť heslo iným
  if (!isSelf && !isAdmin) {
    return { error: "Nemáte oprávnenie meniť heslo tohto používateľa." }
  }

  const passwordError = validatePassword(newPassword)
  if (passwordError) return { error: passwordError }

  const targetUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { username: true, email: true, isAdminAccount: true },
  })
  if (!targetUser) return { error: "Používateľ neexistuje." }

  try {
    const hash = await hashPassword(newPassword)
    await prisma.user.update({ where: { id: userId }, data: { password: hash } })

    await createAuditLog({
      userId: callerId,
      userEmail: session.user.email,
      userName: session.user.name,
      actorUsername: getCallerUsername(session),
      action: "PASSWORD_CHANGE",
      entityType: "USER",
      entityId: userId,
      entityLabel: targetUser.username ?? targetUser.email,
    })

    // Notifikácia ostatných adminov pri zmene hesla admin účtu
    if (targetUser.isAdminAccount) {
      await notifyOtherAdmins(
        callerId,
        "ADMIN_PASSWORD_CHANGED",
        "Zmena hesla administrátorského účtu",
        `Heslo administrátorského účtu „${targetUser.username ?? targetUser.email}" bolo zmenené.`
      )
    }

    revalidatePath(`/dashboard/users/${userId}`)
    return { success: true }
  } catch {
    return { error: "Nastala chyba pri zmene hesla." }
  }
}

export async function blockUser(userId: number): Promise<Result> {
  const session = await getServerSession(authOptions)
  const callerRoles = (session?.user as { roles?: string[] })?.roles ?? []
  if (!session || !callerRoles.includes("SPRAVCA_APLIKACIE")) {
    return { error: "Nemáte oprávnenie blokovať používateľov." }
  }
  if (parseInt(session.user.id) === userId) {
    return { error: "Nemôžete zablokovať vlastný účet." }
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { roles: true, isAdminAccount: true, username: true, email: true },
  })
  if (!user) return { error: "Používateľ neexistuje." }

  // Pravidlo minimálneho počtu správcov: blokovanie admin účtu
  if (user.roles.includes("SPRAVCA_APLIKACIE")) {
    const activeCount = await countActiveAdmins()
    if (activeCount <= MIN_ACTIVE_ADMINS) {
      return {
        error: `Nie je možné zablokovať administrátorský účet — v systéme musia byť vždy aspoň ${MIN_ACTIVE_ADMINS} aktívni správcovia.`,
      }
    }
  }

  const lockedUntil = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) // ~1 rok = manuálne zablokovanie
  try {
    await prisma.user.update({ where: { id: userId }, data: { lockedUntil } })
    await createAuditLog({
      userId: parseInt(session.user.id),
      userEmail: session.user.email,
      userName: session.user.name,
      actorUsername: getCallerUsername(session),
      action: "UPDATE",
      entityType: "USER",
      entityId: userId,
      entityLabel: user.username ?? user.email,
      newData: { action: "MANUAL_BLOCK", lockedUntil: lockedUntil.toISOString() },
    })

    if (user.isAdminAccount) {
      await notifyOtherAdmins(
        parseInt(session.user.id),
        "ADMIN_ROLE_CHANGED",
        "Administrátorský účet zablokovaný",
        `Správca aplikácie ${getCallerUsername(session) ?? session.user.name} zablokoval administrátorský účet „${user.username ?? user.email}".`
      )
    }

    revalidatePath(`/dashboard/users/${userId}`)
    revalidatePath("/dashboard/users")
    return { success: true }
  } catch {
    return { error: "Nastala chyba pri blokovaní." }
  }
}

export async function updateUserIdentity(
  userId: number,
  username: string,
  email: string,
  firstName: string,
  lastName: string
): Promise<Result> {
  const session = await getServerSession(authOptions)
  const callerRoles = (session?.user as { roles?: string[] })?.roles ?? []
  if (!session || !callerRoles.includes("SPRAVCA_APLIKACIE")) {
    return { error: "Nemáte oprávnenie upravovať profil používateľa." }
  }

  const cleanUsername = username.trim().toLowerCase()
  const cleanEmail = email.trim().toLowerCase()
  const cleanFirst = firstName.trim()
  const cleanLast = lastName.trim()

  if (!cleanUsername) return { error: "Používateľské meno je povinné." }
  if (!USERNAME_PATTERN.test(cleanUsername))
    return { error: "Používateľské meno môže obsahovať písmená, číslice, podčiarkovník, bodku a pomlčku (2–50 znakov)." }
  if (!cleanEmail || !EMAIL_PATTERN.test(cleanEmail))
    return { error: "Zadajte platnú e-mailovú adresu." }
  if (!cleanFirst) return { error: "Meno je povinné." }
  if (!cleanLast) return { error: "Priezvisko je povinné." }
  if (cleanFirst.length > 100 || cleanLast.length > 100)
    return { error: "Meno alebo priezvisko je príliš dlhé." }

  const conflict = await prisma.user.findFirst({
    where: { username: cleanUsername, id: { not: userId } },
    select: { id: true },
  })
  if (conflict) return { error: `Používateľské meno „${cleanUsername}" je už obsadené.` }

  const oldUser = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      username: true, email: true, firstName: true, lastName: true,
      linkedUserId: true,
      adminAccounts: { select: { id: true } },
    },
  })
  if (!oldUser) return { error: "Používateľ neexistuje." }

  const personalData = { firstName: cleanFirst, lastName: cleanLast, email: cleanEmail }

  try {
    await prisma.user.update({
      where: { id: userId },
      data: { username: cleanUsername, ...personalData },
    })

    // Sync meno/mail do prepojených účtov
    if (oldUser.linkedUserId) {
      // Toto je admin účet → synchronizuj osobné údaje aj do prepojeného bežného účtu
      await prisma.user.update({ where: { id: oldUser.linkedUserId }, data: personalData })
      revalidatePath(`/dashboard/users/${oldUser.linkedUserId}`)
    }
    if (oldUser.adminAccounts.length > 0) {
      // Toto je bežný účet → synchronizuj do všetkých prepojených admin účtov
      await prisma.user.updateMany({ where: { linkedUserId: userId }, data: personalData })
      for (const a of oldUser.adminAccounts) revalidatePath(`/dashboard/users/${a.id}`)
    }

    await createAuditLog({
      userId: parseInt(session.user.id),
      userEmail: session.user.email,
      userName: session.user.name,
      actorUsername: getCallerUsername(session),
      action: "UPDATE",
      entityType: "USER",
      entityId: userId,
      entityLabel: cleanUsername,
      oldData: { username: oldUser.username, email: oldUser.email, firstName: oldUser.firstName, lastName: oldUser.lastName },
      newData: { username: cleanUsername, email: cleanEmail, firstName: cleanFirst, lastName: cleanLast },
    })
    revalidatePath("/dashboard/users")
    revalidatePath(`/dashboard/users/${userId}`)
    return { success: true }
  } catch {
    return { error: "Nastala chyba pri ukladaní." }
  }
}

export async function setLinkedUser(
  adminUserId: number,
  regularUserId: number | null
): Promise<Result> {
  const session = await getServerSession(authOptions)
  const callerRoles = (session?.user as { roles?: string[] })?.roles ?? []
  if (!session || !callerRoles.includes("SPRAVCA_APLIKACIE")) {
    return { error: "Nemáte oprávnenie spravovať prepojenie účtov." }
  }

  const adminUser = await prisma.user.findUnique({
    where: { id: adminUserId },
    select: { isAdminAccount: true, username: true },
  })
  if (!adminUser || !adminUser.isAdminAccount) {
    return { error: "Zadaný účet nie je administrátorský účet." }
  }

  if (regularUserId !== null) {
    const regularUser = await prisma.user.findUnique({
      where: { id: regularUserId },
      select: { isAdminAccount: true, firstName: true, lastName: true, email: true },
    })
    if (!regularUser || regularUser.isAdminAccount) {
      return { error: "Cieľový účet nie je bežný (nesprávcovský) účet." }
    }
    // Sync osobné údaje
    await prisma.user.update({
      where: { id: adminUserId },
      data: {
        linkedUserId: regularUserId,
        firstName: regularUser.firstName,
        lastName: regularUser.lastName,
        email: regularUser.email,
      },
    })
  } else {
    await prisma.user.update({ where: { id: adminUserId }, data: { linkedUserId: null } })
  }

  await createAuditLog({
    userId: parseInt(session.user.id),
    userEmail: session.user.email,
    userName: session.user.name,
    actorUsername: getCallerUsername(session),
    action: "UPDATE",
    entityType: "USER",
    entityId: adminUserId,
    entityLabel: adminUser.username,
    newData: { linkedUserId: regularUserId },
  })

  revalidatePath("/dashboard/users")
  revalidatePath(`/dashboard/users/${adminUserId}`)
  if (regularUserId) revalidatePath(`/dashboard/users/${regularUserId}`)
  return { success: true }
}

export async function setUserUtvary(
  userId: number,
  utvarIds: number[]
): Promise<Result> {
  const session = await getServerSession(authOptions)
  const callerRoles = (session?.user as { roles?: string[] })?.roles ?? []
  if (!session || !callerRoles.includes("SPRAVCA_APLIKACIE")) {
    return { error: "Nemáte oprávnenie spravovať zaradenie do útvarov." }
  }

  try {
    await prisma.userUtvar.deleteMany({ where: { userId } })
    if (utvarIds.length > 0) {
      await prisma.userUtvar.createMany({
        data: utvarIds.map((utvarId) => ({ userId, utvarId })),
      })
    }
    await createAuditLog({
      userId: parseInt(session.user.id),
      userEmail: session.user.email,
      userName: session.user.name,
      actorUsername: getCallerUsername(session),
      action: "UPDATE",
      entityType: "USER_UTVAR",
      entityId: userId,
      entityLabel: null,
      newData: { userId, utvarIds },
    })
    revalidatePath(`/dashboard/users/${userId}`)
    return { success: true }
  } catch {
    return { error: "Nastala chyba pri ukladaní." }
  }
}

export async function setUserRoomAccess(
  userId: number,
  roomIds: number[]
): Promise<Result> {
  const session = await getServerSession(authOptions)
  const callerRoles = (session?.user as { roles?: string[] })?.roles ?? []
  if (!session || (!callerRoles.includes("SPRAVCA_MAJETKU") && !callerRoles.includes("SPRAVCA_APLIKACIE"))) {
    return { error: "Nemáte oprávnenie spravovať prístupy do miestností." }
  }

  try {
    await prisma.userRoomAccess.deleteMany({ where: { userId } })
    if (roomIds.length > 0) {
      await prisma.userRoomAccess.createMany({
        data: roomIds.map((roomId) => ({ userId, roomId })),
      })
    }
    await createAuditLog({
      userId: parseInt(session.user.id),
      userEmail: session.user.email,
      userName: session.user.name,
      actorUsername: getCallerUsername(session),
      action: "UPDATE",
      entityType: "ROOM_ACCESS",
      entityId: userId,
      entityLabel: null,
      newData: { userId, roomIds },
    })
    revalidatePath(`/dashboard/users/${userId}`)
    revalidatePath("/dashboard/rooms")
    return { success: true }
  } catch {
    return { error: "Nastala chyba pri ukladaní." }
  }
}

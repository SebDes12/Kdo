/** Les enfants sans e-mail se connectent avec un pseudo, traduit en adresse technique. */
export const CHILD_EMAIL_DOMAIN =
  process.env.NEXT_PUBLIC_CHILD_EMAIL_DOMAIN ?? "enfants.kdo.invalid";

export function loginToEmail(identifier: string): string {
  const id = identifier.trim().toLowerCase();
  return id.includes("@") ? id : `${id}@${CHILD_EMAIL_DOMAIN}`;
}

/**
 * Reads the society already attached to the authenticated user.
 * Society scope is never taken from a caller-supplied id.
 * Missing details stay blank rather than falling back to another society.
 */
export function readSocietyIdentity(user) {
  const society = user?.society;
  if (!society || typeof society !== 'object' || Array.isArray(society)) {
    return {
      name: null,
      registrationNumber: null,
      label: 'Society details unavailable',
    };
  }

  const name = typeof society.name === 'string' && society.name.trim() ? society.name.trim() : null;
  const registrationNumber =
    typeof society.registrationNumber === 'string' && society.registrationNumber.trim()
      ? society.registrationNumber.trim()
      : null;

  let label = 'Society details unavailable';
  if (name && registrationNumber) {
    label = `${name} • ${registrationNumber}`;
  } else if (name) {
    label = name;
  } else if (registrationNumber) {
    label = registrationNumber;
  }

  return { name, registrationNumber, label };
}

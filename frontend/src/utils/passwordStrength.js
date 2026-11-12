// ==============================================================
// PASSWORD STRENGTH  -  checks how strong a password is
// ==============================================================

// ---------- common passwords we block ----------
const COMMON_PASSWORDS = [                                                          // passwords everyone guesses first
  'password', 'password1', 'password123',                                           // too common
  '12345678', '123456789', 'qwerty123',                                             // too common
  'iloveyou', 'admin123', 'welcome1', 'abc12345',                                   // too common
];

// ==============================================================
// MAIN FUNCTION  -  gives back weak, medium or strong
// ==============================================================
export function checkPassword(password) {                                           // takes the password text
  // ---------- rules ----------
  const hasLength = password.length >= 8;                                           // at least 8 characters
  const isLong = password.length >= 12;                                             // 12 or more is extra good
  const hasLower = /[a-z]/.test(password);                                          // has a small letter
  const hasUpper = /[A-Z]/.test(password);                                          // has a capital letter
  const hasNumber = /[0-9]/.test(password);                                         // has a number
  const hasSymbol = /[^A-Za-z0-9]/.test(password);                                  // has a symbol like ! or @
  const isCommon = COMMON_PASSWORDS.includes(password.toLowerCase());               // is it a common password

  // ---------- count types ----------
  const types = [hasLower, hasUpper, hasNumber, hasSymbol].filter(Boolean).length;  // how many types used

  // ---------- pick the level ----------
  let level = 'weak';                                                               // start as weak
  if (hasLength && !isCommon && types >= 3) level = 'medium';                       // 8+ chars and 3 types
  if (isLong && !isCommon && types === 4) level = 'strong';                         // 12+ chars and all 4 types

  // ---------- tips to show the user ----------
  const tips = [];                                                                  // list of things to add
  if (!hasLength) tips.push('8+ characters');                                       // too short
  if (!hasLower) tips.push('a small letter');                                       // no small letter
  if (!hasUpper) tips.push('a capital letter');                                     // no capital letter
  if (!hasNumber) tips.push('a number');                                            // no number
  if (!hasSymbol) tips.push('a symbol');                                            // no symbol
  if (isCommon) tips.push('a less common password');                                // too common

  // ---------- send back the result ----------
  return { level, tips, ok: level !== 'weak' };                                     // ok is true for medium and strong
}
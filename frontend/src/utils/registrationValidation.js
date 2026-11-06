/**
 * Client-side registration checks. The invitation code is required because it
 * selects the only society a new account may join. The server repeats these checks.
 */
export function validateRegistrationForm(formData = {}) {
  const errors = {};
  const name = typeof formData.name === 'string' ? formData.name.trim() : '';
  const email = typeof formData.email === 'string' ? formData.email.trim() : '';
  const phone = typeof formData.phone === 'string' ? formData.phone.trim() : '';
  const apartmentNumber = typeof formData.apartmentNumber === 'string' ? formData.apartmentNumber.trim() : '';
  const societyCode = typeof formData.societyCode === 'string' ? formData.societyCode.trim() : '';
  const password = typeof formData.password === 'string' ? formData.password : '';
  const confirmPassword = typeof formData.confirmPassword === 'string' ? formData.confirmPassword : '';

  if (!name) errors.name = 'Full name is required.';

  if (!email) {
    errors.email = 'Email address is required.';
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.email = 'Please provide a valid email format.';
  }

  if (!phone) {
    errors.phone = 'Phone number is required for society notifications.';
  } else if (!/^\+?[0-9\s-]{10,14}$/.test(phone)) {
    errors.phone = 'Please enter a valid phone number (10+ digits).';
  }

  if (!apartmentNumber) {
    errors.apartmentNumber = 'Apartment/Flat unit number is required.';
  }

  if (!societyCode) {
    errors.societyCode = 'Society invitation code is required.';
  }

  if (!password) {
    errors.password = 'Password is required.';
  } else if (password.length < 8) {
    errors.password = 'Password must be at least 8 characters long.';
  }

  if (!confirmPassword) {
    errors.confirmPassword = 'Confirmation password is required.';
  } else if (password !== confirmPassword) {
    errors.confirmPassword = 'Passwords do not match.';
  }

  return errors;
}

export function registrationFieldErrorsFromApi(details) {
  if (!Array.isArray(details)) return {};
  return details.reduce((errors, item) => {
    if (item && typeof item.field === 'string' && typeof item.message === 'string' && item.message.trim()) {
      errors[item.field] = item.message.trim();
    }
    return errors;
  }, {});
}

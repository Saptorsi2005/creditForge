/**
 * Currency Formatter Utility
 * Formats currency values in Indian Rupee format
 * Values are assumed to be stored in the database in rupees
 */

/**
 * Format currency in Indian format
 * @param {number} amount - Amount in rupees
 * @param {string} mode - 'rupees' or 'crores'
 * @returns {string} Formatted currency string
 */
function formatCurrencyINR(amount, mode = 'crores') {
  // Handle null/undefined/zero cases
  if (amount === null || amount === undefined) {
    return mode === 'crores' ? '₹ 0 Cr' : '₹ 0';
  }

  const numAmount = Number(amount);
  
  if (isNaN(numAmount) || numAmount === 0) {
    return mode === 'crores' ? '₹ 0 Cr' : '₹ 0';
  }

  if (mode === 'crores') {
    // Convert rupees to crores (1 Cr = 10,000,000)
    const inCrores = numAmount / 10000000;
    
    // Format with Indian locale, 2 decimal places
    const formatted = inCrores.toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
    
    return `₹ ${formatted} Cr`;
  } else {
    // Format in rupees with Indian numbering system
    const formatted = numAmount.toLocaleString('en-IN', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    });
    
    return `₹ ${formatted}`;
  }
}

/**
 * Format number with Indian locale (without currency symbol)
 * @param {number} value - Numeric value
 * @param {number} decimals - Number of decimal places (default: 2)
 * @returns {string} Formatted number
 */
function formatNumber(value, decimals = 2) {
  if (value === null || value === undefined) return '0.00';
  
  try {
    return Number(value).toLocaleString('en-IN', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    });
  } catch (e) {
    return Number(value).toFixed(decimals);
  }
}

module.exports = {
  formatCurrencyINR,
  formatNumber
};

/**
 * Test Currency Formatter
 * Verify that the formatter correctly converts rupees to crores
 */

const { formatCurrencyINR, formatNumber } = require('./src/utils/currencyFormatter');

console.log('Testing Currency Formatter\n');
console.log('=' .repeat(60));

// Test values (stored in database in rupees)
const testCases = [
  { rupees: 35000000, expectedCrores: '₹ 3.50 Cr', expectedRupees: '₹ 3,50,00,000' },
  { rupees: 85000000, expectedCrores: '₹ 8.50 Cr', expectedRupees: '₹ 8,50,00,000' },
  { rupees: 5000000, expectedCrores: '₹ 0.50 Cr', expectedRupees: '₹ 50,00,000' },
  { rupees: 50000000, expectedCrores: '₹ 5.00 Cr', expectedRupees: '₹ 5,00,00,000' },
  { rupees: 0, expectedCrores: '₹ 0 Cr', expectedRupees: '₹ 0' },
  { rupees: null, expectedCrores: '₹ 0 Cr', expectedRupees: '₹ 0' },
];

console.log('\n📊 Testing Crores Format (mode = "crores")\n');
testCases.forEach(({ rupees, expectedCrores }) => {
  const result = formatCurrencyINR(rupees, 'crores');
  const status = result === expectedCrores ? '✅ PASS' : '❌ FAIL';
  console.log(`${status} | Input: ${rupees} rupees`);
  console.log(`   Expected: ${expectedCrores}`);
  console.log(`   Got:      ${result}`);
  console.log('');
});

console.log('\n💰 Testing Rupees Format (mode = "rupees")\n');
testCases.slice(0, 4).forEach(({ rupees, expectedRupees }) => {
  const result = formatCurrencyINR(rupees, 'rupees');
  const status = result === expectedRupees ? '✅ PASS' : '❌ FAIL';
  console.log(`${status} | Input: ${rupees} rupees`);
  console.log(`   Expected: ${expectedRupees}`);
  console.log(`   Got:      ${result}`);
  console.log('');
});

console.log('\n🔢 Testing Number Formatter\n');
const numberTests = [
  { value: 3.5, decimals: 2, expected: '3.50' },
  { value: 8.5, decimals: 2, expected: '8.50' },
  { value: 1234.56, decimals: 2, expected: '1,234.56' },
];

numberTests.forEach(({ value, decimals, expected }) => {
  const result = formatNumber(value, decimals);
  const status = result === expected ? '✅ PASS' : '❌ FAIL';
  console.log(`${status} | Input: ${value}, Decimals: ${decimals}`);
  console.log(`   Expected: ${expected}`);
  console.log(`   Got:      ${result}`);
  console.log('');
});

console.log('=' .repeat(60));
console.log('\nTest completed! Run: node test-currency-formatter.js\n');

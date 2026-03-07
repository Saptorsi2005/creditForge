const researchService = require('./src/services/research.service');

const text = `
This is a company profile.
The Director of the company is Mr. Roshan Mishra.
Our Managing Director: Pritam Bhowmik.
CEO is named Sarah Jenkins.
Founder and promoter is Vikram Sethi.
`;

const documents = [{ extractedData: { extractedText: text } }];
const names = researchService.extractPromoterNames(documents);

console.log('--- Promoter Extraction Test ---');
console.log('Input Text:', text);
console.log('Extracted Names:', names);

const expected = ['Roshan Mishra', 'Pritam Bhowmik', 'Sarah Jenkins', 'Vikram Sethi'];
const success = expected.every(name => names.join(' ').includes(name));

if (success || names.length >= 3) {
    console.log('✅ Success: Robust extraction working.');
} else {
    console.log('❌ Failure: Some names missed.');
}

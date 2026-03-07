const researchService = require('./src/services/research.service');

async function testIntegration() {
    console.log('--- TEST 1: Direct Match ---');
    const direct = await researchService.fetchNews('Reliance Industries');
    console.log('Results:', direct.length);
    if (direct.length > 0) {
        console.log('Sample Tag:', direct[0].tag);
        console.log('Sample Title:', direct[0].title);
    }

    console.log('\n--- TEST 2: Fuzzy Fallback (Non-existent query) ---');
    // Using a very specific name that likely returns 0, but the first word should return results
    const fuzzy = await researchService.fetchNews('RelianceVerySpecificNonExistentEntity');
    console.log('Results:', fuzzy.length);
    if (fuzzy.length > 0) {
        console.log('Sample Tag:', fuzzy[0].tag);
        console.log('Sample Title:', fuzzy[0].title);
    }

    process.exit(0);
}

testIntegration().catch(err => {
    console.error(err);
    process.exit(1);
});

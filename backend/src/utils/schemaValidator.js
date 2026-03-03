const { PrismaClient, Prisma } = require('@prisma/client');
const prisma = new PrismaClient(); // instantiate a new client for validation to ensure isolated execution

async function validateSchema() {
    console.log('[SchemaSync] Starting schema validation...');
    try {
        // 1. Verify multiYearRevenue column in company_analysis table
        const columns = await prisma.$queryRaw`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'company_analysis' AND column_name = 'multiYearRevenue';
    `;

        if (columns.length === 0) {
            console.log('[SchemaSync] multiYearRevenue column is missing. Adding it automatically...');
            await prisma.$executeRawUnsafe(`ALTER TABLE "company_analysis" ADD COLUMN "multiYearRevenue" JSONB;`);
            console.log('[SchemaSync] ✅ Added missing column multiYearRevenue');
        } else {
            const col = columns[0];
            if (col.data_type.toLowerCase() !== 'jsonb' && col.data_type.toLowerCase() !== 'json') {
                throw new Error(`[SchemaSync FATAL] multiYearRevenue column has wrong type: ${col.data_type}. Expected: JSONB.`);
            }
            console.log('[SchemaSync] ✅ multiYearRevenue column verified (exists and is JSONB).');
        }

        // 2. Verify applicationId unique constraint
        const indexes = await prisma.$queryRaw`
      SELECT i.relname as index_name, a.attname as column_name
      FROM pg_class t, pg_class i, pg_index ix, pg_attribute a
      WHERE t.oid = ix.indrelid AND i.oid = ix.indexrelid
        AND a.attrelid = t.oid AND a.attnum = ANY(ix.indkey)
        AND t.relkind = 'r' AND t.relname = 'company_analysis'
        AND a.attname = 'applicationId' AND ix.indisunique = true;
    `;

        if (indexes.length === 0) {
            console.log('[SchemaSync] applicationId unique constraint is missing. Adding it automatically...');
            try {
                await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX "company_analysis_applicationId_key" ON "company_analysis"("applicationId");`);
                console.log('[SchemaSync] ✅ Added missing applicationId unique constraint.');
            } catch (e) {
                console.warn('[SchemaSync Warning] Could not add unique index on applicationId. May contain duplicates.', e.message);
            }
        } else {
            console.log('[SchemaSync] ✅ applicationId unique constraint verified.');
        }

        // 3. Extra safety: Check if Prisma schema model matches DB (Specifically checking Prisma DMMF)
        const dmmf = Prisma.dmmf;
        const companyAnalysisModel = dmmf.datamodel.models.find(m => m.name === 'CompanyAnalysis');
        if (!companyAnalysisModel) {
            console.warn('[SchemaSync Warning] CompanyAnalysis model not found in Prisma schema.');
        } else {
            const hasField = companyAnalysisModel.fields.some(f => f.name === 'multiYearRevenue');
            if (!hasField) {
                console.warn('[SchemaSync Warning] Prisma schema and database are out of sync. multiYearRevenue is missing in schema.prisma');
            }
        }

        // 4. Test Automation: Re-fetch one row and row count safely
        const rowCountBytes = await prisma.$queryRaw`SELECT count(*) as total FROM company_analysis;`;
        const rowCount = Number(rowCountBytes[0]?.total || 0);
        console.log(`[SchemaSync] company_analysis rows: ${rowCount}`);

        if (rowCount > 0) {
            const sampleRow = await prisma.companyAnalysis.findFirst({
                orderBy: { updatedAt: 'desc' }
            });
            const hasData = sampleRow.multiYearRevenue ? 'Yes' : 'No';
            console.log(`[SchemaSync] Sample row multiYearRevenue populated: ${hasData}`);
        } else {
            console.log(`[SchemaSync] No rows in company_analysis to test multiYearRevenue population.`);
        }

    } catch (error) {
        if (error.message.includes('[SchemaSync FATAL]')) {
            console.error(error.message);
            process.exit(1); // Stop server on fatal error
        } else {
            console.error('[SchemaSync] Non-fatal error during schema validation:', error.message);
        }
    } finally {
        await prisma.$disconnect();
    }
}

module.exports = validateSchema;

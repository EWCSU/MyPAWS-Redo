const pool = require('./db');

async function testDatabaseConnection()
{
    try
    {
        const result = await pool.query('SELECT NOW()');
        console.log('Database connected succsessfully!');
        console.log('Current database time:', result.rows[0].now);
    }
    catch (error)
    {
        console.error('Database connection failed:', error.message);
    }
    finally
    {
        await pool.end();
    }
}

testDatabaseConnection();

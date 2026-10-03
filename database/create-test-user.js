const bcrypt = require('bcrypt');
const pool = require('./db');

async function createTestUser()
{
    const email = 'teststudent@coyote.csusb.edu';
    const password = 'Test123!';
    const role = 'student';

    try
    {
        const passwordHash = await bcrypt.hash(password, 10);

        const result = await pool.query(
            `INSERT INTO users(email, password_hash, role)
            VALUES ($1, $2, $3)
            RETURNING user_id, email, role`,
            [email, passwordHash, role]
        );

        console.log('Test user created successfully!');
        console.log(result.rows[0]);
    }
    catch(error)
    {
        console.error('Error creating test user:', error.message);
    }
    finally
    {
        await pool.end();
    }
}

createTestUser();

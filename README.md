**Project Overview:**
The myPAWS Redo is a web application designed to improve the student experience when viewing academic progress, degree audits, coursework, remaining requirements, and academic planning.

1. **Prerequisites: **\
  Before starting, install the following:
    - node.js and npm -to run the application
    - PostgreSQL -for the database
    - Git -to download the repository
    - Visual Studio or VS Code -recommended for opening the project
   
   A Gmail account configured with an app password is also needed to test email verification and password recovery.

2. **Clone the project**
	
  Open PowerShell or your preferred terminal.  
_Run:_  
    git clone -- branch prototype-v2 --single-branch  https://github.com/EWCSU/MyPAWS-Redo.git   
    Navigate into the project folder:  
	    cd MYPAWS-Redo

3. **Install dependencies**

  _Run:_  
    npm.cmd ci  
	This installs the necessary Node.js packages.  
	Note: On Windows PowerShell, use npm,cmd if the regular npm is blocked.  

4. **Configure PostgreSQL**
    - Open PostgreSQL using pgAdmin
    -  Create a new database named mypaws_redo
    - Keep track of your local PostgreSQL username and password
	
  Each user is to use their own local database.

**5. Configure environment variables**
  
  In the project’s main folder, create a file named .env. Use the project’s .env.example file as a reference.

  Example configuration file:
  # PostgreSQL database
    DATABASE_URL="postgresql://postgres:CHANGE_ME@localhost:5432/mypaws_redo?schema=public"

  # Authentication
    JWT_SECRET="REPLACE_WITH_A_LONG_RANDOM_SECRET"
    NODE_ENV=development

  # Email verification and password recovery
    EMAIL_USER="YOUR_TEST_GMAIL@gmail.com"
    EMAIL_PASS="YOUR_GMAIL_APP_PASSWORD"

  # Application configuration
    PORT=3000
    APP_BASE_URL="http://localhost:3000"
    CLIENT_ORIGIN="http://localhost:3000"
  
  Replace the placeholder values with your own local configuration.

>[!CAUTION]
>**Never upload your .env file, passwords, or other credentials to GitHub.**

6. **Set Up Prisma**
  Generate Prisma Client:
    .\node_modules\.bin\prisma.cmd generate
  Apply the existing database migrations:
	  .\node_modules\.bin\prisma.cmd migrate deploy
  These commands prepare a newly created PostgreSQL database for the application

7. **Request and Import Test Data: **
  To test the Student Dashboard, Degree Audit, Coursework, Remaining Requirements, and MyCAPS, you will need sample student audit data.
  To obtain the test-data files, please email the Project Manager at: or the Assistant Project Manager at:
  
  The test data is not included in the GitHub Repository.
    a. Obtain the test data
    b. Create the data folder. Open PowerShell in the main project directory and run:
      i. New-Item -ItemType Directory -Path .\private-data -Force
        Place the ZIP field directly inside private-data.
        
        Your folder should look similar to this:
          MyPAWS-Redo/
          –prisma/
          –public/
          –routes/
          –scripts/
          –private-data/
	          –student1.zip
	          –student2.zip
          –.env
          –server.js
c. Import Student Records:
      Make sure PostgreSQL is running and that you have already completed the Prisma Setup.
      The project includes an import script:
	      node .\scripts\importStudentData.js
      This script reads supported PAWS audit ZIP files from the private-data directory and imports their information into PostgreSQL.    
      Confirm the expected ZIP filenames with the PM or APM before running the import.
    d. Create Test Accounts:
		After importing the data, student accounts must be linked to the imported records.	 
For a fresh database containing exactly two student records and no existing accounts, run:
			Node .\scripts\createTestAccounts.js
The script should create two student accounts and display their test credentials in the terminal.
	
Start the application
Run:
npm.cmd start
Keep the terminal open while the server is running.
Open your browser and visit:
http://localhost:3000
Log in using a test account.
The MyPAWS Redo login should appear.
To stop the server, press Ctrl + C in the terminal.
Verify your Login
Check the Gmail inbox configured as EMAIL_USER in your .env file.
Locate the MyPAWS verification email.
Enter the six-digit verification code.
Continue to the Student Dashboard.

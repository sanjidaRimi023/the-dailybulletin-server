  # ⚡ The Daily Bulletin - Server

This repository contains the source code for the Node.js and Express.js server that powers The Daily Bulletin. It provides a complete RESTful API for handling all core functionalities, including user authentication, article management, publisher data, and premium subscription payments via Stripe.The server is designed to work seamlessly with the React-based client side, providing secure and efficient data management through a MongoDB database.
##  Key Features

- **RESTful API:** -  A well-structured API for managing users, articles, publishers, and payments.

- **JWT Authentication:** -Secure API endpoints using JSON Web Tokens (JWT) to protect routes and manage user sessions.
-  **Role-Based Access Control:** - Differentiates between regular users, premium users, and admins, ensuring users can only access authorized resources
-  **CRUD Operations:** -Full Create, Read, Update, and Delete functionalities for articles and publishers, interacting directly with the MongoDB database.
-  **Payment Integration:** - Securely process subscription payments using the Stripe API to handle premium user upgrades.
-  **Secure Configuration** -  Utilizes environment variables (.env) to keep sensitive information like database credentials and API keys safe.
##  Tech Stack
- **Tuntime :** Node js
- **Framework:** Express.js
- **Database :** Mongodb
- **Authentication :** JSON web token(jwt)
- **Middleware :**

- cors for handling Cross-Origin Resource Sharing.

- dotenv for managing environment variables.


##  Getting Started
Follow these instructions to get a local copy of the server up and running for development and testing.

## 1. clone the repo : 



```javascript
git clone https://github.com/sanjidaRimi023/the-dailybulletin-server.git
cd the-dailybulletin-server
```

### install dependencies

```javascript
npm install
```

### 3.Create a .env.local file:
Create a file named .env.local in the root folder of the project and add your Firebase and other keys there.


```javascript
# MongoDB Configuration
DB_USER=your_mongodb_username
DB_PASS=your_mongodb_password

# JWT Configuration
ACCESS_TOKEN_SECRET=your_super_secret_jwt_key_that_is_long_and_random

# Stripe Configuration
STRIPE_SECRET_KEY=your_stripe_secret_api_key

# Server Port (Optional, defaults to 5000 if not set)
PORT=5000
```
### 4.Start the development server:
This command uses nodemon to automatically restart the server when you make changes.

```bash
npm run dev
```
## License

This project is licensed under the **MIT License** - see the [LICENSE](LICENSE) file for details.

### License
This project is licensed under the ISC License. See the LICENSE file for more details.

---

**Made with ❤️ by [Sanjida Rimi](https://github.com/sanjidaRimi023)**










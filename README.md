# 📈 Stock Broker Client Web Dashboard

A real-time, client-side dashboard application designed to simulate a stock trading environment, providing users with live, asynchronous price updates for subscribed stocks.

---

## ✨ Key Features

Based on the problem statement, the dashboard includes the following core functionalities:

* **Secure Authentication:** Users can register and log in using their email, secured with JSON Web Tokens (JWT).
* **Stock Subscription:** Users can subscribe/unsubscribe to a supported stock ticker (e.g., `GOOG`, `TSLA`) to personalize their dashboard feed.
* **Real-Time Asynchronous Updates:** Stock prices are updated automatically and asynchronously (without refreshing the page) every second.
* **Multi-User Live Sync:** The system supports multiple concurrent users, ensuring each dashboard receives only the live updates for *their* subscribed stocks.
* **Mock Price Generation:** Price updates are simulated using a **random number generator** on the backend to demonstrate real-time data streaming without requiring a paid market data API.
* **Supported Stocks:** `['GOOG', 'TSLA', 'AMZN', 'META', 'NVDA']`

---

## 💻 Tech Stack

The application is built as a complete full-stack solution optimized for real-time communication.

| Component | Technology | Role |
| :--- | :--- | :--- |
| **Frontend** | **React** (JavaScript) | Component-based, reactive UI for the dashboard and authentication. |
| **Backend Runtime** | **Node.js** | High-performance JavaScript runtime environment. |
| **Real-Time Layer** | **Socket.IO** | Establishes a persistent **WebSocket** connection for instant, asynchronous server-to-client price updates. |
| **API Framework** | **Express.js** | Minimalist, flexible Node.js web application framework for RESTful authentication and subscription endpoints. |
| **Database** | **PostgreSQL** | Relational database used to store user data (emails, encrypted passwords) and subscribed stock positions. |
| **ORM** | **Prisma** | Modern database toolkit used for type-safe database access and managing migrations. |
| **Hosting** | **Render** | Cloud platform used for production deployment of the Node.js backend and PostgreSQL database. |

---

## ⚙️ System Architecture and Process Flow

The architecture is designed around a dedicated real-time communication channel (WebSocket) that is distinct from the RESTful API endpoints, ensuring instantaneous price updates.



### **The Real-Time Update Flow**

1.  **User Subscribes (REST):** A logged-in user hits a **REST endpoint** (`POST /api/subscribe`) to add a stock to their position list. The backend saves this in the PostgreSQL database via Prisma.
2.  **Server Initializes (Socket.IO):** The backend starts a background process that runs on a 1-second interval.
3.  **Price Generation:** On every 1-second tick, the process generates a new random price for each supported stock ticker.
4.  **Selective Broadcasting:** The server iterates through all currently **connected Socket.IO clients (users)**.
    * For each connected user, the server checks their subscribed stock list in the database.
    * The server uses a Socket.IO room/user ID pattern to send a price update **only to the specific user's connection**, ensuring asynchronous, personalized updates without broadcasting unnecessary data.

### **Authentication Flow**

1.  User submits credentials to the `/auth/register` or `/auth/login` **REST endpoint**.
2.  Server authenticates the user and returns a **JWT**.
3.  The client stores the JWT and uses it to establish its persistent **Socket.IO connection** and authorize future REST requests (e.g., subscribing to a new stock).

---

## 🚀 Getting Started (Local Setup)

To run this project locally, follow these steps:

### Prerequisites

* Node.js (LTS recommended)
* Git
* A deployed PostgreSQL instance (e.g., your Render database or a local instance).

### Installation and Run

1.  **Clone the Repository:**
    ```bash
    git clone [YOUR_REPO_URL]
    cd stock-escrow-dashboard
    ```

2.  **Backend Setup (`backend/` directory):**
    * Create a `.env` file in the `backend/` directory based on `backend/.env.example`.
    * **Crucially, use your External Render Database URL** (or a local database URL) in the `DATABASE_URL` variable for local development.
    * Install dependencies and apply migrations:
        ```bash
        cd backend
        npm install
        npx prisma migrate dev --name init # Creates and applies initial tables
        ```
    * Start the backend server:
        ```bash
        npm run dev
        ```

3.  **Frontend Setup (`frontend/` directory):**
    * Navigate to the frontend directory:
        ```bash
        cd ../frontend
        npm install
        ```
    * Create a `.env` file based on `frontend/.env.example`.
    * Start the frontend server:
        ```bash
        npm run dev
        ```

The application will now be accessible locally, usually on `http://localhost:3000` (Frontend) and `http://localhost:10000` (Backend).

```markdown
# Hotspot Billing System  

A robust and user-friendly system designed to manage internet access for hotspot users. This project combines efficient backend development with seamless payment processing to ensure a smooth user experience.  

## Features  

- **Captive Portal**: Redirects users to a login or payment interface when they connect to the network.  
- **User Authentication**: Supports secure login and session management.  
- **Subscription Management**: Allows users to view and purchase internet plans.  
- **Payment Integration**: Utilizes **IntaSend STK Push API** for secure and reliable transactions.  
- **Access Control**: Automatically enables or disables internet access based on subscription status.  
- **Admin Dashboard**: Provides tools for managing routers, users, and plans.  

## Tech Stack  

### Backend  
- **Node.js**: Handles server-side logic and API endpoints.  
- **TypeScript**: Adds type safety and enhances code maintainability.  
- **Prisma ORM**: Simplifies database operations with **PostgreSQL**.  

### Database  
- **PostgreSQL**: Stores user, subscription, and payment data.  

### Payment Processing  
- **IntaSend STK Push API**: Facilitates mobile money transactions.  

## Installation  

### Prerequisites  
- Node.js (v16+ recommended)  
- PostgreSQL (v13+)  
- IntaSend API credentials  

### Steps  
1. **Clone the repository**:  
   ```bash  
   git clone https://github.com/yourusername/hotspot-billing-system.git  
   cd hotspot-billing-system  
    

2. **Install dependencies**:  
   ```bash  
   npm install  
   

3. **Set up environment variables**:  
   Create a `.env` file in the root directory and include:  
   ```env  
   DATABASE_URL=postgresql://username:password@localhost:5432/hotspot_db  
   INTASEND_API_KEY=your_api_key  
   INTASEND_PUBLIC_KEY=your_public_key  
   

4. **Run database migrations**:  
   ```bash  
   npx prisma migrate dev  
    

5. **Start the server**:  
   ```bash  
   npm run dev  
  

## API Endpoints  

### Authentication  
- **POST /api/auth/login**: Log in a user.  
- **POST /api/auth/register**: Register a new user.  

### Subscriptions  
- **GET /api/subscriptions**: Retrieve available plans.  
- **POST /api/subscriptions/purchase**: Purchase a plan.  

### Payments  
- **POST /api/payments/initiate**: Initiate an STK push for payment.  
- **GET /api/payments/status/:id**: Check payment status.  

## How It Works  

1. **Captive Portal**:  
   When a user connects to the network, they are redirected to the captive portal where they can log in or view available plans.  

2. **Plan Selection**:  
   Users can browse and select from available internet plans.  

3. **Payment Processing**:  
   Upon selecting a plan, the system initiates an STK Push via the IntaSend API. Users confirm payment on their mobile devices.  

4. **Internet Access**:  
   Once payment is successful, the system enables internet access for the user. Access is disabled when the plan expires.  

## Future Improvements  
- Add multi-language support for broader accessibility.  
- Implement analytics for usage and revenue tracking.  
- Introduce email notifications in addition to SMS alerts.  

## Contributing  

Contributions are welcome! Please fork this repository and submit a pull request with your proposed changes.  

## License  

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.  

## Contact  

For any questions or feedback, please reach out to [yourname](mailto:youremail@example.com).  

---  
**[GitHub Repository](https://github.com/Earl006/spiderLAN-hotspot.git)**  
```  


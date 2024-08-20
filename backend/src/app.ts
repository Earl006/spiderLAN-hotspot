import express from 'express';
import authRoutes from './routes/auth.routes';
import buildingRoutes from './routes/building.routes';
import userRoutes from './routes/user.routes';
import planRoutes from './routes/plan.routes';
import routerRoutes from './routes/router.routes';
import paymentRoutes from './routes/payment.routes';

const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

app.use('/api/auth/', authRoutes);
app.use('/api/building/', buildingRoutes);
app.use('/api/user/', userRoutes);
app.use('/api/plan/', planRoutes);
app.use('/api/router/', routerRoutes);
app.use('/api/payment/', paymentRoutes);


export default app;
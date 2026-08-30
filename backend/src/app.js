import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import 'dotenv/config';

import authRoutes from './modules/auth/auth.routes.js';
import restaurantRoutes from './modules/restaurant/restaurant.routes.js';
import accountingRoutes from './modules/accounting/accounting.routes.js';
import customerRoutes from './modules/shared/customers/customer.routes.js';
import vendorRoutes from './modules/shared/vendors/vendor.routes.js';
import { serveMenuImage } from './utils/menuImageStorage.js';

const app = express();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

app.use(express.json({ limit: '50mb' }))
app.use(express.urlencoded({ limit: '50mb', extended: true }))

app.use(cors({
  origin: true,
  credentials: true
}));

app.use('/uploads', express.static(path.join(__dirname, '../uploads'), { fallthrough: true, maxAge: '1d' }));
app.get('/uploads/menu/:filename', serveMenuImage);

app.use('/api', authRoutes)
app.use('/api/customers', customerRoutes)
app.use('/api/vendors', vendorRoutes)
app.use('/api', restaurantRoutes)
app.use('/api/accounting', accountingRoutes)

app.get('/', (req, res) => {
    res.send('Restaurant API running');
});

export default app;

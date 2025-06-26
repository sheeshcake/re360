import express from 'express';
import cors from 'cors';
import cron from 'node-cron';
import {createServer} from "node:http"
import {Server} from "socket.io";
import * as authController from "./controllers/authController.js";
import {authenticateToken} from "./controllers/authController.js";
import * as userController from "./controllers/userController.js";
import * as messageController from "./controllers/messageController.js";
import * as miscController from "./controllers/miscController.js";
import * as realEstateController from "./controllers/realEstateController.js";
import * as leaseController from "./controllers/leaseController.js";
import * as tenantController from "./controllers/tenantController.js";
import {checkOverduePayments} from "./jobs/overduePayments.js";
import * as paymentController from "./controllers/paymentController.js";
import jwt from "jsonwebtoken";
import {createMessage} from "./controllers/messageController.js";
import * as maintenanceController from "./controllers/maintenanceController.js";
import * as expenseController from "./controllers/expenseController.js";

// eslint-disable-next-line no-undef
const PORT = process.env.PORT || 3000;

const app = express();
const router = express.Router();
app.use(cors());
app.use(express.json());
app.use(router);


app.get('api/', (req, res) => {
    res.send('Hello World!');
})

// Auth
router.post('api/signup', authController.createRealtor);
router.post('api/login', authController.login);
router.post('api/refresh', authController.refresh);

// User
router.get('api/user', authenticateToken, userController.getUser)
router.patch('api/user', authenticateToken, userController.updateUser)
router.delete('api/user', authenticateToken, userController.deleteUser)

// Messages
router.get('api/messages', authenticateToken, messageController.getMessages)
router.post('api/messages', authenticateToken, messageController.createMessage)

// Misc
router.post('api/currency', authenticateToken, miscController.setCurrency)


// Properties
router.get('api/properties', authenticateToken, realEstateController.getProperties)
router.post('api/properties', authenticateToken, realEstateController.createProperty)
router.get('api/properties/:id', authenticateToken, realEstateController.getProperty)
router.delete('api/properties/:id', authenticateToken, realEstateController.deleteProperty)

// Units / Rentals
router.get('api/units', authenticateToken, realEstateController.getUnits)
router.get('api/units/:id', authenticateToken, realEstateController.getUnit)
router.patch('api/units/:id', authenticateToken, realEstateController.updateUnit)
router.put('api/units/:id/tenant', authenticateToken, tenantController.assignTenantToUnit)

// Leases
router.get('api/leases', authenticateToken, leaseController.getLeases)
router.get('api/leases/:id', authenticateToken, leaseController.getLease)
router.patch('api/leases/:id', authenticateToken, leaseController.updateLease)
router.delete('api/leases/:id', authenticateToken, leaseController.deleteLease)
router.post('api/leases', authenticateToken, leaseController.createLease)

// Tenants
router.get('api/tenants', authenticateToken, tenantController.getTenants)
router.post('api/tenants', authenticateToken, tenantController.createTenant)
router.get('api/tenants/:id', authenticateToken, tenantController.getTenant)
router.delete('api/tenants/:id', authenticateToken, tenantController.deleteTenant)
router.put('api/tenants/:id', authenticateToken, tenantController.updateTenant)

// Payments
router.post('api/payments', authenticateToken, paymentController.createPayment)
router.get('api/payments', authenticateToken, paymentController.getPayments)
router.put('api/payments/:id', authenticateToken, paymentController.updatePayment)
router.delete('api/payments/:id', authenticateToken, paymentController.deletePayment)

// Lease Payment Schedules
router.put('api/payment-schedules/:id', authenticateToken, paymentController.updatePaymentSchedule)
router.delete('api/payment-schedules/:id', authenticateToken, paymentController.deletePaymentSchedule)

// Maintenance Reports
router.get('api/maintenance', authenticateToken, maintenanceController.getMaintenanceReports)
router.post('api/maintenance', authenticateToken, maintenanceController.createMaintenanceReport)

// Expenses
router.get('api/expenses', authenticateToken, expenseController.getExpenses)
router.post('api/expenses', authenticateToken, expenseController.createExpense)
router.delete('api/expenses/:id', authenticateToken, expenseController.deleteExpense)


// Bulk
router.patch('api/bulk/leases', authenticateToken, leaseController.updateManyLeases)
router.delete('api/bulk/leases', authenticateToken, leaseController.deleteManyLeases)
router.patch('api/bulk/payment-schedules', authenticateToken, paymentController.updateManyPaymentSchedules)
router.delete('api/bulk/payment-schedules', authenticateToken, paymentController.deleteManyPaymentSchedules)
router.post('api/bulk/payments', authenticateToken, paymentController.createManyPayments)
router.patch('api/bulk/payments', authenticateToken, paymentController.updateManyPayments)
router.delete('api/bulk/payments', authenticateToken, paymentController.deleteManyPayments)

//Jobs
//      Schedule the job to run daily at 00:00 (midnight)
cron.schedule('0 0 * * *', checkOverduePayments);


app.use((err, req, res, next) => {
    console.log(err.stack);
    res.status(500).send('Something broke!');
})


const server = createServer(app );
const io = new Server(server, {
    cors: {
        origin: process.env.VITE_PUBLIC_URL,
        methods: ["GET", "POST"],
        credentials: true
    }
})
const userSocketIds = {};


io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    jwt.verify(token, process.env.SECRET_KEY, (err, user) => {
        if (err) {
            return next(new Error('Authentication error'));
        }
        socket.user = user;
        userSocketIds[user.userId] = socket.id;
        next();
    });
})

io.on('connection', (socket) => {
    //console.log('A user connected');
    // Handle message sending
    socket.on('send_message', (message) => {
        const {type, content, receiverId} = message;

        const messageData = {
            type: type,
            content: content,
            senderId: socket.user.userId,
            receiverId: receiverId
        }

        // Here, you can add additional logic, such as saving messages to your database
        createMessage(messageData).then((response) => {
            const receiverSocketId = userSocketIds[receiverId];
            // Send the message to the receiver
            io.to(receiverSocketId).emit('receive_message', response);
            // Send the message to the sender
            //io.to(socket.id).emit('receive_message', response);
        }).catch((error) => {
            console.log('Error sending message', error);
        })
    });

    socket.on('disconnect', () => {
        if (socket.user && socket.user.userId) {
            delete userSocketIds[socket.user.userId];
        }
        //console.log('User disconnected');
    });
});

server.listen(PORT, () => {
    console.log('App listening on port ' + PORT);
})



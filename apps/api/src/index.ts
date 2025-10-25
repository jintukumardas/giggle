import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { config } from './config';
import whatsappRouter from './routes/whatsapp.route';
import statusRouter from './routes/status.route';
import deeplinkRouter from './routes/deeplink.route';

const app: Express = express();

// Trust proxy - required for ngrok and other proxies
app.set('trust proxy', 1);

// Security middleware
app.use(helmet({
  contentSecurityPolicy: false, // Disable for QR code pages
}));

// CORS
app.use(cors());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
});

app.use('/whatsapp', limiter);

// Body parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging middleware
app.use((req: Request, _res: Response, next: NextFunction) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Health check
app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: config.nodeEnv,
    chain: config.blockchain.chainName,
  });
});

// Routes
app.use('/whatsapp', whatsappRouter);
app.use('/status-callback', statusRouter);
app.use('/deeplink', deeplinkRouter);

// Root endpoint
app.get('/', (_req: Request, res: Response) => {
  res.json({
    name: 'Giggle API',
    description: 'WhatsApp-based stablecoin payment system',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      whatsapp: '/whatsapp',
      statusCallback: '/status-callback',
      deeplink: '/deeplink/:userId',
    },
  });
});

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    error: 'Not Found',
    path: req.path,
  });
});

// Error handler
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Error:', err);
  res.status(500).json({
    error: 'Internal Server Error',
    message: config.nodeEnv === 'development' ? err.message : undefined,
  });
});

// Start server
const PORT = config.port;

app.listen(PORT, () => {
  console.log('');
  console.log('🚀 Giggle API Server');
  console.log('='.repeat(50));
  console.log(`Environment: ${config.nodeEnv}`);
  console.log(`Server: http://localhost:${PORT}`);
  console.log(`Chain: ${config.blockchain.chainName} (${config.blockchain.chainId})`);
  console.log(`Twilio WhatsApp: ${config.twilio.whatsappNumber}`);
  console.log('='.repeat(50));
  console.log('');
  console.log('📱 Webhook URL (use with ngrok):');
  console.log(`   ${config.baseUrl}/whatsapp`);
  console.log('');
  console.log('⚠️  Remember to:');
  console.log('   1. Run ngrok: ngrok http ${PORT}');
  console.log('   2. Update Twilio webhook with ngrok URL');
  console.log('   3. Join Twilio sandbox: text "join <code>" to +1 415 523 8886');
  console.log('');
});

export default app;

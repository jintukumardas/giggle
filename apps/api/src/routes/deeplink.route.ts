import { Router, Request, Response } from 'express';
import QRCode from 'qrcode';

const router = Router();

/**
 * Generate QR code page for WalletConnect
 */
router.get('/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;

    // In a production implementation, you would:
    // 1. Generate a WalletConnect URI
    // 2. Store the session for the user
    // 3. Present the URI as a QR code and deep link

    // For now, we'll create a placeholder WalletConnect-style URI
    const wcUri = `wc:placeholder-${userId}@2?relay-protocol=irn&symKey=placeholder`;

    // Generate QR code
    const qrCodeDataUrl = await QRCode.toDataURL(wcUri, {
      width: 300,
      margin: 2,
    });

    // Create HTML page with QR code
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Link Wallet - Giggle</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }

    .container {
      background: white;
      border-radius: 20px;
      padding: 40px;
      max-width: 500px;
      width: 100%;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
      text-align: center;
    }

    h1 {
      font-size: 32px;
      margin-bottom: 10px;
      color: #333;
    }

    .subtitle {
      color: #666;
      margin-bottom: 30px;
      font-size: 16px;
    }

    .qr-container {
      background: #f8f9fa;
      border-radius: 15px;
      padding: 20px;
      margin-bottom: 30px;
    }

    .qr-code {
      max-width: 100%;
      height: auto;
    }

    .instructions {
      text-align: left;
      background: #f8f9fa;
      padding: 20px;
      border-radius: 10px;
      margin-bottom: 20px;
    }

    .instructions h2 {
      font-size: 18px;
      margin-bottom: 15px;
      color: #333;
    }

    .instructions ol {
      padding-left: 20px;
    }

    .instructions li {
      margin-bottom: 10px;
      color: #555;
      line-height: 1.6;
    }

    .deep-link-btn {
      display: inline-block;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      text-decoration: none;
      padding: 15px 40px;
      border-radius: 10px;
      font-weight: 600;
      font-size: 16px;
      transition: transform 0.2s, box-shadow 0.2s;
    }

    .deep-link-btn:hover {
      transform: translateY(-2px);
      box-shadow: 0 10px 20px rgba(102, 126, 234, 0.4);
    }

    .warning {
      background: #fff3cd;
      border: 1px solid #ffc107;
      border-radius: 8px;
      padding: 15px;
      margin-top: 20px;
      font-size: 14px;
      color: #856404;
    }

    @media (max-width: 600px) {
      .container {
        padding: 30px 20px;
      }

      h1 {
        font-size: 24px;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>🔗 Link Your Wallet</h1>
    <p class="subtitle">Connect your wallet to start sending stablecoins on WhatsApp</p>

    <div class="qr-container">
      <img src="${qrCodeDataUrl}" alt="WalletConnect QR Code" class="qr-code">
    </div>

    <div class="instructions">
      <h2>How to connect:</h2>
      <ol>
        <li>Open your mobile wallet app (MetaMask, Rainbow, Trust Wallet, etc.)</li>
        <li>Tap on "WalletConnect" or scan QR code</li>
        <li>Scan the QR code above</li>
        <li>Approve the connection in your wallet</li>
        <li>Return to WhatsApp to start using Giggle!</li>
      </ol>
    </div>

    <a href="${wcUri}" class="deep-link-btn">Open in Wallet App</a>

    <div class="warning">
      ⚠️ <strong>Testnet Only</strong><br>
      This is a demo using Base Sepolia testnet. No real money is involved.
    </div>
  </div>

  <script>
    // Auto-detect wallet apps and deep link on mobile
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

    if (isMobile) {
      // Try to deep link to common wallet apps
      const deepLinks = [
        'metamask://wc?uri=${encodeURIComponent(wcUri)}',
        'rainbow://wc?uri=${encodeURIComponent(wcUri)}',
        'trust://wc?uri=${encodeURIComponent(wcUri)}'
      ];

      // Note: In production, you'd use a proper WalletConnect library
      // that handles deep linking and session management
    }
  </script>
</body>
</html>
    `;

    res.send(html);
  } catch (error) {
    console.error('Error generating QR code:', error);
    res.status(500).send('Error generating QR code');
  }
});

/**
 * WalletConnect callback (for storing session info)
 */
router.post('/callback', async (req: Request, res: Response) => {
  try {
    // In production, this would handle WalletConnect session approval
    // and store the session topic and wallet address for the user
    const { userId, walletAddress, sessionTopic } = req.body;

    console.log('WalletConnect callback:', { userId, walletAddress, sessionTopic });

    res.json({ success: true });
  } catch (error) {
    console.error('Error handling WalletConnect callback:', error);
    res.status(500).json({ error: 'Failed to process callback' });
  }
});

export default router;

import { Router, Request, Response } from 'express';
import { userService } from '../services/user.service';
import { TwilioStatusCallback } from '../types';

const router = Router();

/**
 * Twilio status callback - tracks message delivery status
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const payload: TwilioStatusCallback = req.body;
    const { MessageSid, MessageStatus, ErrorCode, ErrorMessage } = payload;

    // Log the status update
    await userService.logAudit(
      null,
      'message_status_update',
      {
        messageSid: MessageSid,
        status: MessageStatus,
        errorCode: ErrorCode,
        errorMessage: ErrorMessage,
      }
    );

    console.log(`Message ${MessageSid} status: ${MessageStatus}`);

    if (ErrorCode) {
      console.error(`Message error: ${ErrorCode} - ${ErrorMessage}`);
    }

    res.sendStatus(200);
  } catch (error) {
    console.error('Error handling status callback:', error);
    res.sendStatus(500);
  }
});

export default router;

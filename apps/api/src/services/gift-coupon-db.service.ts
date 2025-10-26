import { db } from '../db';
import { giftCoupons } from '../db/schema';
import { eq, and, or } from 'drizzle-orm';
import { randomBytes } from 'crypto';

export class GiftCouponDbService {
  /**
   * Save a gift coupon to the database
   */
  async saveCoupon(params: {
    code: string;
    creatorId: string;
    amount: string;
    token: string;
    message?: string;
    expiresAt?: Date;
    txHash?: string;
  }): Promise<void> {
    const now = new Date();

    await db.insert(giftCoupons).values({
      id: randomBytes(16).toString('hex'),
      code: params.code,
      creatorId: params.creatorId,
      amount: params.amount,
      token: params.token,
      message: params.message,
      status: 'active',
      expiresAt: params.expiresAt,
      txHash: params.txHash,
      createdAt: now,
      updatedAt: now,
    });
  }

  /**
   * Mark a coupon as redeemed
   */
  async markAsRedeemed(code: string, redeemedBy: string, txHash: string): Promise<void> {
    const now = new Date();

    await db.update(giftCoupons)
      .set({
        status: 'redeemed',
        redeemedBy,
        redeemedAt: now,
        txHash,
        updatedAt: now,
      })
      .where(eq(giftCoupons.code, code));
  }

  /**
   * Get all active (unredeemed) coupons created by a user
   */
  async getUserActiveCoupons(creatorId: string) {
    return db.select()
      .from(giftCoupons)
      .where(
        and(
          eq(giftCoupons.creatorId, creatorId),
          eq(giftCoupons.status, 'active')
        )
      )
      .orderBy(giftCoupons.createdAt);
  }

  /**
   * Get all coupons redeemed by a user
   */
  async getUserRedeemedCoupons(userId: string) {
    return db.select()
      .from(giftCoupons)
      .where(eq(giftCoupons.redeemedBy, userId))
      .orderBy(giftCoupons.redeemedAt);
  }

  /**
   * Get coupon by code
   */
  async getCouponByCode(code: string) {
    const result = await db.select()
      .from(giftCoupons)
      .where(eq(giftCoupons.code, code))
      .limit(1);

    return result[0] || null;
  }

  /**
   * Get all coupons (created or redeemed) for a user
   */
  async getAllUserCoupons(userId: string) {
    return db.select()
      .from(giftCoupons)
      .where(
        or(
          eq(giftCoupons.creatorId, userId),
          eq(giftCoupons.redeemedBy, userId)
        )
      )
      .orderBy(giftCoupons.createdAt);
  }
}

export const giftCouponDbService = new GiftCouponDbService();

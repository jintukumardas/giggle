import { User, OnboardingStep, NetworkType, TokenType } from '../types';
import { userService } from './user.service';

/**
 * Onboarding Service
 * Manages the user onboarding flow for Giggle Pay
 */
export class OnboardingService {
  /**
   * Check if user needs onboarding
   */
  needsOnboarding(user: User): boolean {
    return !user.onboardingCompleted;
  }

  /**
   * Get current onboarding step for user
   */
  getCurrentStep(user: User): OnboardingStep {
    return user.onboardingStep || 'welcome';
  }

  /**
   * Advance user to next onboarding step
   */
  async advanceToNextStep(userId: string, currentStep: OnboardingStep): Promise<OnboardingStep> {
    const stepFlow: OnboardingStep[] = ['welcome', 'pin', 'network', 'token', 'completed'];
    const currentIndex = stepFlow.indexOf(currentStep);
    const nextStep = stepFlow[currentIndex + 1] || 'completed';

    await userService.updateUser(userId, { onboardingStep: nextStep });
    return nextStep;
  }

  /**
   * Update onboarding step
   */
  async updateStep(userId: string, step: OnboardingStep): Promise<void> {
    await userService.updateUser(userId, { onboardingStep: step });
  }

  /**
   * Handle PIN setup during onboarding
   */
  async handlePinSetup(userId: string, pinHash: string): Promise<void> {
    await userService.updateUser(userId, { pinHash });
    await this.advanceToNextStep(userId, 'pin');
  }

  /**
   * Handle network selection during onboarding
   */
  async handleNetworkSelection(userId: string, network: NetworkType): Promise<void> {
    await userService.updateUser(userId, { defaultNetwork: network });
    await this.advanceToNextStep(userId, 'network');
  }

  /**
   * Handle token selection during onboarding
   */
  async handleTokenSelection(userId: string, token: TokenType): Promise<void> {
    await userService.updateUser(userId, { defaultToken: token });
    await this.advanceToNextStep(userId, 'token');
  }

  /**
   * Complete onboarding
   */
  async completeOnboarding(userId: string): Promise<void> {
    await userService.updateUser(userId, {
      onboardingCompleted: true,
      onboardingStep: 'completed',
    });
  }

  /**
   * Skip optional step (network or token)
   */
  async skipStep(userId: string, currentStep: OnboardingStep): Promise<OnboardingStep> {
    // Only network and token steps can be skipped
    if (currentStep === 'network' || currentStep === 'token') {
      return await this.advanceToNextStep(userId, currentStep);
    }
    return currentStep;
  }

  /**
   * Reset onboarding (for testing or re-onboarding)
   */
  async resetOnboarding(userId: string): Promise<void> {
    await userService.updateUser(userId, {
      onboardingCompleted: false,
      onboardingStep: 'welcome',
      pinHash: undefined,
    });
  }

  /**
   * Get onboarding progress percentage
   */
  getProgress(step: OnboardingStep): number {
    const stepProgress: Record<OnboardingStep, number> = {
      welcome: 0,
      pin: 25,
      network: 50,
      token: 75,
      completed: 100,
    };
    return stepProgress[step] || 0;
  }
}

export const onboardingService = new OnboardingService();

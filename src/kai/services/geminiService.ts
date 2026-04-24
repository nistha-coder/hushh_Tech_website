/**
 * SECURITY: Client-side Gemini usage is permanently disabled.
 * All Gemini access must go through a secure backend endpoint.
 */

import { UserPersona, GeminiServiceConfig } from '../types';

export class GeminiService {
  private config: GeminiServiceConfig;

  constructor(config: GeminiServiceConfig) {
    this.config = config;
  }

  async connect(persona: UserPersona = 'Everyday Investor') {
    throw new Error(
      "Gemini client-side usage has been disabled for security reasons. Use a secure backend endpoint."
    );
  }
}

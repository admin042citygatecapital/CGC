import 'dotenv/config';
import { 
  sendVerificationEmail, 
  sendWelcomeEmail, 
  sendAdminOtpEmail, 
  sendFinalActivationEmail 
} from '../src/server/lib/emailService.js';

async function main() {
  const testEmail = 'test-stress@example.com'; // Replace with real test email if provided
  const testName = 'Stress Test User';
  const iterations = 20;
  
  console.log(`🚀 Starting Email Stress Test: Sending ${iterations} emails to ${testEmail}...`);
  
  const results = { success: 0, failure: 0 };
  const startTime = Date.now();

  for (let i = 1; i <= iterations; i++) {
    try {
      console.log(`[${i}/${iterations}] Sending email...`);
      
      // Cycle through different templates to test various rendering paths
      if (i % 4 === 0) {
        await sendVerificationEmail(testEmail, testName, 'token-123', 'https://citygate.capital');
      } else if (i % 4 === 1) {
        await sendWelcomeEmail(testEmail, testName);
      } else if (i % 4 === 2) {
        await sendAdminOtpEmail(testEmail, testName, '123456', '127.0.0.1', 'Playwright/Headless');
      } else {
        await sendFinalActivationEmail(testEmail, testName);
      }
      
      results.success++;
    } catch (e) {
      console.error(`❌ Failed at iteration ${i}:`, e instanceof Error ? e.message : String(e));
      results.failure++;
    }
  }

  const duration = Date.now() - startTime;
  console.log('\n--- Stress Test Results ---');
  console.log(`Total Sent:     ${iterations}`);
  console.log(`✅ Success:     ${results.success}`);
  console.log(`❌ Failures:    ${results.failure}`);
  console.log(`Total Time:    ${duration}ms`);
  console.log(`Avg per email: ${duration / iterations}ms`);
}

main().catch(console.error);

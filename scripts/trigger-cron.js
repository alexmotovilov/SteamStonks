// Script to manually trigger the Steam collector cron job

const CRON_SECRET = process.env.CRON_SECRET;
const BASE_URL = process.env.VERCEL_URL 
  ? `https://${process.env.VERCEL_URL}` 
  : 'http://localhost:3000';

async function triggerCron() {
  console.log('Triggering Steam collector cron job...');
  console.log('URL:', `${BASE_URL}/api/cron/steam-collector`);
  
  try {
    const response = await fetch(`${BASE_URL}/api/cron/steam-collector`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${CRON_SECRET}`,
      },
    });
    
    const data = await response.json();
    console.log('Response status:', response.status);
    console.log('Response data:', JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('Error triggering cron:', error.message);
  }
}

triggerCron();

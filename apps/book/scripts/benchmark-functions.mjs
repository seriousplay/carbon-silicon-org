import { getEventSummary, getQuestionDistributions, generateInsightsForRun } from '../src/lib/assessment/server-summary.ts';

const eventSlug = '20260517-hr-od-workshop';

async function run() {
  console.log('=== Function-level Benchmark ===\n');

  console.log('1. getEventSummary:');
  const start1 = Date.now();
  const summary = await getEventSummary(eventSlug);
  const time1 = Date.now() - start1;
  console.log('   Time:', time1, 'ms');
  console.log('   Participants:', summary.participantCount);

  console.log('\n2. getQuestionDistributions:');
  const start2 = Date.now();
  const dist = await getQuestionDistributions(eventSlug);
  const time2 = Date.now() - start2;
  console.log('   Time:', time2, 'ms');
  console.log('   Questions:', dist.length);

  console.log('\n3. generateInsightsForRun:');
  const start3 = Date.now();
  const insights = await generateInsightsForRun(eventSlug);
  const time3 = Date.now() - start3;
  console.log('   Time:', time3, 'ms');
  console.log('   Insights:', insights.length);

  console.log('\n4. getEventSummary (2nd call - should hit cache):');
  const start4 = Date.now();
  const summary2 = await getEventSummary(eventSlug);
  const time4 = Date.now() - start4;
  console.log('   Time:', time4, 'ms');
  console.log('   Speedup:', (time1/time4).toFixed(1), 'x');

  console.log('\n=== Summary ===');
  console.log('getEventSummary:', time1, 'ms (cache:', time4, 'ms)');
  console.log('getQuestionDistributions:', time2, 'ms');
  console.log('generateInsightsForRun:', time3, 'ms');
  console.log('Total (parallel): ~', Math.max(time1, time2, time3), 'ms');
}

run().catch(console.error);

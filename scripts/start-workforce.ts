import { WorkforceRuntime } from '../packages/workforce/runtime/WorkforceRuntime.js';

async function main() {
  console.log('⚡ Booting Hilux Autonomous AI Workforce OS...');
  const runtime = await WorkforceRuntime.boot({
    name: 'Hilux Enterprise Workforce',
    mission: 'The Operating System for Autonomous AI Workforces',
  });

  console.log('\n🚀 Dispatching Executive Goal to CEO...');
  await runtime.ceo.setCompanyGoal({
    title: 'Deploy Autonomous Enterprise Security & Multi-Agent Infrastructure',
    description: 'Decompose and execute enterprise-wide security, database migrations, and API integrations across 9 departments using NVIDIA Nemotron reasoning.',
    priority: 'critical',
    deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  });

  console.log('\n📊 Generating Consolidated Organization Health Check...');
  const health = await runtime.organization.runHealthCheck();
  console.log(JSON.stringify(health, null, 2));

  console.log('\n✅ Hilux System Online & Active!');
}

main().catch(err => {
  console.error('Fatal workforce execution error:', err);
  process.exit(1);
});

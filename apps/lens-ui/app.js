/**
 * Hilux Lens UI — Core Application Logic & Live Canvas Rendering
 */

document.addEventListener('DOMContentLoaded', () => {
  initNavigation();
  initAgentGraphCanvas();
  initReasoningStream();
  initTerminalStream();
  initGpuGaugeCanvas();
  initInteractions();
});

// ── NAVIGATION & VIEW SWITCHING ─────────────────────────────────────────────
function initNavigation() {
  const navItems = document.querySelectorAll('.nav-item');
  const viewPanels = document.querySelectorAll('.view-panel');

  navItems.forEach(item => {
    item.addEventListener('click', () => {
      const viewId = item.getAttribute('data-view');

      // Update active nav button
      navItems.forEach(n => n.classList.remove('active'));
      item.classList.add('active');

      // Update active view panel
      viewPanels.forEach(p => p.classList.remove('active'));
      const targetPanel = document.getElementById(`view-${viewId}`);
      if (targetPanel) {
        targetPanel.classList.add('active');
      }
    });
  });
}

// ── LIVE AGENT FORCE NETWORK GRAPH (CANVAS) ──────────────────────────────────
function initAgentGraphCanvas() {
  const canvas = document.getElementById('agentGraphCanvas');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  let width = (canvas.width = canvas.parentElement.clientWidth);
  let height = (canvas.height = canvas.parentElement.clientHeight);

  window.addEventListener('resize', () => {
    width = canvas.width = canvas.parentElement.clientWidth;
    height = canvas.height = canvas.parentElement.clientHeight;
  });

  // Workforce nodes
  const nodes = [
    { id: 'ceo', label: 'CEO', category: 'exec', x: width * 0.5, y: height * 0.18, radius: 24, color: '#00f2ff', status: 'executing' },
    { id: 'cto', label: 'CTO', category: 'exec', x: width * 0.35, y: height * 0.38, radius: 20, color: '#8b5cf6', status: 'executing' },
    { id: 'cpo', label: 'CPO', category: 'exec', x: width * 0.65, y: height * 0.38, radius: 20, color: '#f59e0b', status: 'reflecting' },
    { id: 'eng', label: 'Engineering (7)', category: 'dept', x: width * 0.22, y: height * 0.65, radius: 18, color: '#00f2ff', status: 'executing' },
    { id: 'research', label: 'Research (2)', category: 'dept', x: width * 0.38, y: height * 0.75, radius: 16, color: '#10b981', status: 'idle' },
    { id: 'marketing', label: 'Marketing (2)', category: 'dept', x: width * 0.78, y: height * 0.65, radius: 16, color: '#f43f5e', status: 'executing' },
    { id: 'finance', label: 'Finance (2)', category: 'dept', x: width * 0.50, y: height * 0.82, radius: 16, color: '#10b981', status: 'idle' },
    { id: 'legal', label: 'Legal (1)', category: 'dept', x: width * 0.62, y: height * 0.72, radius: 14, color: '#f59e0b', status: 'amber' },
    { id: 'support', label: 'Support (3)', category: 'dept', x: width * 0.88, y: height * 0.48, radius: 16, color: '#00f2ff', status: 'executing' },
    { id: 'analytics', label: 'Analytics (2)', category: 'dept', x: width * 0.12, y: height * 0.48, radius: 16, color: '#8b5cf6', status: 'reflecting' },
  ];

  // Connections
  const links = [
    { from: 'ceo', to: 'cto' },
    { from: 'ceo', to: 'cpo' },
    { from: 'cto', to: 'eng' },
    { from: 'cto', to: 'research' },
    { from: 'cto', to: 'analytics' },
    { from: 'cpo', to: 'marketing' },
    { from: 'cpo', to: 'support' },
    { from: 'ceo', to: 'finance' },
    { from: 'ceo', to: 'legal' },
    { from: 'eng', to: 'research' },
  ];

  // Floating particles
  const particles = Array.from({ length: 35 }, () => ({
    x: Math.random() * width,
    y: Math.random() * height,
    vx: (Math.random() - 0.5) * 0.6,
    vy: (Math.random() - 0.5) * 0.6,
    size: Math.random() * 2 + 1,
  }));

  let pulseAngle = 0;

  function render() {
    ctx.clearRect(0, 0, width, height);

    // Draw background grid
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
    ctx.lineWidth = 1;
    const gridSize = 40;
    for (let x = 0; x < width; x += gridSize) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke();
    }
    for (let y = 0; y < height; y += gridSize) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke();
    }

    // Draw ambient particles
    particles.forEach(p => {
      p.x += p.vx; p.y += p.vy;
      if (p.x < 0 || p.x > width) p.vx *= -1;
      if (p.y < 0 || p.y > height) p.vy *= -1;

      ctx.fillStyle = 'rgba(0, 242, 255, 0.25)';
      ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
    });

    // Draw links
    links.forEach(link => {
      const source = nodes.find(n => n.id === link.from);
      const target = nodes.find(n => n.id === link.to);
      if (!source || !target) return;

      ctx.beginPath();
      ctx.moveTo(source.x, source.y);
      ctx.lineTo(target.x, target.y);
      ctx.strokeStyle = 'rgba(0, 242, 255, 0.15)';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Traveling energy particle
      const t = (Date.now() * 0.001 + links.indexOf(link) * 0.3) % 1;
      const px = source.x + (target.x - source.x) * t;
      const py = source.y + (target.y - source.y) * t;

      ctx.fillStyle = source.color;
      ctx.shadowColor = source.color;
      ctx.shadowBlur = 8;
      ctx.beginPath(); ctx.arc(px, py, 3, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;
    });

    // Draw nodes
    pulseAngle += 0.04;
    nodes.forEach(node => {
      const glowScale = Math.sin(pulseAngle) * 4;

      // Glow halo
      ctx.beginPath();
      ctx.arc(node.x, node.y, node.radius + 6 + glowScale, 0, Math.PI * 2);
      ctx.fillStyle = `${node.color}15`;
      ctx.fill();

      // Inner Node Circle
      ctx.beginPath();
      ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
      ctx.fillStyle = '#0e121b';
      ctx.strokeStyle = node.color;
      ctx.lineWidth = 2;
      ctx.fill();
      ctx.stroke();

      // Node Label
      ctx.fillStyle = '#f8fafc';
      ctx.font = '600 12px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(node.label, node.x, node.y + node.radius + 16);
    });

    requestAnimationFrame(render);
  }

  render();
}

// ── STREAMING AI THINKING STREAM ─────────────────────────────────────────────
function initReasoningStream() {
  const container = document.getElementById('thoughtStream');
  if (!container) return;

  const thoughts = [
    { time: '15:12:01.042', role: 'CEO', text: 'Decomposed Goal "Launch Enterprise Autonomous Workforce v2.0" into 3 department directives.' },
    { time: '15:12:02.118', role: 'CTO', text: 'Issued technical architecture specification to Engineering sub-departments (Frontend, Backend, DB, Security, DevOps).' },
    { time: '15:12:03.490', role: 'Frontend Engineer', text: 'Compiling Lens UI spatial components. Verified glassmorphic CSS tokens.' },
    { time: '15:12:04.821', role: 'Backend Engineer', text: 'Initializing Kahn topological DAG execution pipeline. 3 execution layers built.' },
    { time: '15:12:05.612', role: 'Security Engineer', text: 'Audit passed: Zero hardcoded credentials, full audit logging enabled on MessageBus.' },
    { time: '15:12:06.904', role: 'DevOps Engineer', text: 'Helm chart compiled for Kubernetes runtime deployment. 22 pods ready.' },
  ];

  thoughts.forEach((t, i) => {
    setTimeout(() => {
      const entry = document.createElement('div');
      entry.className = 'thought-entry';
      entry.innerHTML = `
        <div class="thought-time">[${t.time}] — WORKER: ${t.role}</div>
        <div class="thought-text">${t.text}</div>
      `;
      container.appendChild(entry);
      container.scrollTop = container.scrollHeight;
    }, i * 1200);
  });
}

// ── REAL-TIME TERMINAL LOG STREAM ───────────────────────────────────────────
function initTerminalStream() {
  const container = document.getElementById('terminalLogs');
  const input = document.getElementById('termInput');
  if (!container) return;

  const initialLogs = [
    { time: '15:12:00', topic: 'worker.exec-ceo-001', msg: 'Goal assigned: "Launch Enterprise Autonomous Workforce v2.0"' },
    { time: '15:12:01', topic: 'department.engineering.directive', msg: 'Directive received: Technical spec compilation' },
    { time: '15:12:02', topic: 'worker.frontend-001', msg: 'Memory recalled: 14 past UI component patterns' },
    { time: '15:12:03', topic: 'worker.backend-001', msg: 'DAG Topologically Sorted: 3 layers, parallelism factor 2.33' },
  ];

  initialLogs.forEach(l => appendLog(l.time, l.topic, l.msg));

  if (input) {
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && input.value.trim() !== '') {
        const text = input.value.trim();
        const now = new Date().toTimeString().split(' ')[0];
        appendLog(now, 'human.operator', `Injected directive: "${text}"`);
        input.value = '';

        // Simulate AI response
        setTimeout(() => {
          appendLog(now, 'worker.exec-ceo-001', `Acknowledged human directive: "${text}". Re-sorting DAG...`);
        }, 800);
      }
    });
  }

  function appendLog(time, topic, msg) {
    const line = document.createElement('div');
    line.className = 'log-line';
    line.innerHTML = `
      <span class="log-time">[${time}]</span>
      <span class="log-topic">[${topic}]</span>
      <span class="log-msg">${msg}</span>
    `;
    container.appendChild(line);
    container.scrollTop = container.scrollHeight;
  }
}

// ── HARDWARE GPU GAUGE CANVAS ────────────────────────────────────────────────
function initGpuGaugeCanvas() {
  const canvas = document.getElementById('gpuGaugeCanvas');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  const cx = w / 2;
  const cy = h / 2;
  const r = 70;

  let percent = 0;
  const targetPercent = 0.88; // 88%

  function drawGauge() {
    ctx.clearRect(0, 0, w, h);

    // Background track
    ctx.beginPath();
    ctx.arc(cx, cy, r, Math.PI * 0.75, Math.PI * 2.25);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = 12;
    ctx.lineCap = 'round';
    ctx.stroke();

    // Active arc
    if (percent < targetPercent) percent += 0.01;
    const currentAngle = Math.PI * 0.75 + (Math.PI * 1.5 * percent);

    const grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#00f2ff');
    grad.addColorStop(1, '#8b5cf6');

    ctx.beginPath();
    ctx.arc(cx, cy, r, Math.PI * 0.75, currentAngle);
    ctx.strokeStyle = grad;
    ctx.lineWidth = 12;
    ctx.lineCap = 'round';
    ctx.stroke();

    requestAnimationFrame(drawGauge);
  }

  drawGauge();
}

// ── BUTTON INTERACTION HANDLERS ──────────────────────────────────────────────
function initInteractions() {
  const newGoalBtn = document.getElementById('newGoalBtn');
  const execReviewBtn = document.getElementById('execReviewBtn');
  const approveEscBtn = document.getElementById('approveEscBtn');
  const rejectEscBtn = document.getElementById('rejectEscBtn');

  if (newGoalBtn) {
    newGoalBtn.addEventListener('click', () => {
      const goal = prompt('Enter Executive Goal for Hilux AI Workforce:', 'Expand market presence by launching automated compliance suite');
      if (goal) {
        alert(`[CEO] Goal received: "${goal}". Decomposing across 9 departments!`);
      }
    });
  }

  if (execReviewBtn) {
    execReviewBtn.addEventListener('click', () => {
      alert('[CEO] Executing Weekly Executive Review across 9 departments...\nResult: All 22 workers performing above 90% KPI target.');
    });
  }

  if (approveEscBtn) {
    approveEscBtn.addEventListener('click', () => {
      alert('[Human Operator] Approved Escalation #esc-8812. Worker [DatabaseEngineer] resuming concurrent migration.');
    });
  }
}

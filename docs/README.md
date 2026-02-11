# Threat Modeling Platform - GitHub Pages Demo

This directory contains a static demo site for the Threat Modeling Platform, hosted on GitHub Pages.

## 🌐 Live Demo

Visit: `https://yourusername.github.io/threat-model-platform/`

## 📁 Structure

```
docs/
├── index.html           # Landing page with features showcase
├── demo.html            # Interactive threat modeling demo
├── demo.js              # Client-side threat analysis engine (50+ patterns)
├── styles.css           # Complete responsive styling
├── architecture.html    # System architecture diagrams (Mermaid)
├── walkthrough.html     # Installation guide
├── api-reference.html   # API documentation
└── README.md           # This file
```

## ✨ Features

### 🏠 Landing Page (`index.html`)
- Hero section with platform overview
- 8-card feature grid
- Architecture preview with Mermaid diagram
- Browser mockup showing demo interface
- Installation instructions for Linux/macOS/Windows/Docker
- Technology stack showcase
- Call-to-action sections

### 🎮 Interactive Demo (`demo.html` + `demo.js`)
- **Client-side threat analysis** (no backend required)
- **50+ pre-coded threat patterns** covering:
  - STRIDE categories (Spoofing, Tampering, Repudiation, Information Disclosure, DoS, Elevation)
  - 8 component types (web-server, api-gateway, database, cache, storage, auth, messaging, cdn)
  - Cloud-specific threats (AWS, Azure, GCP, Kubernetes)
- **Compliance mapping** (OWASP, NIST, CIS, PCI-DSS, HIPAA, GDPR, ISO 27001)
- **Severity scoring** (Critical, High, Medium, Low)
- **JSON export** of threat analysis results
- **Load example** button for quick demo

### 🏗️ Architecture Documentation (`architecture.html`)
- **8 comprehensive Mermaid diagrams**:
  1. High-level architecture (8 subgraphs)
  2. API request flow (sequence diagram)
  3. Database schema (ER diagram)
  4. Threat analysis pipeline (30+ nodes)
  5. Technology stack layers
  6. Security architecture
  7. Deployment architecture
  8. Additional system views

### 📖 Walkthrough (`walkthrough.html`)
- Prerequisites checklist
- Installation instructions for all platforms
- Feature configuration guide (LLM, Jira, GitHub)
- Manual installation steps
- Verification and testing
- Common commands reference
- Troubleshooting guide

### 📚 API Reference (`api-reference.html`)
- Complete REST API documentation
- Authentication with JWT (RS256)
- Threat models CRUD operations
- Analysis endpoints
- Jira integration endpoints
- Health & monitoring
- Error codes and rate limiting
- Webhook configuration
- SDK examples (JavaScript, Python, cURL)

## 🚀 How It Works

### Client-Side Threat Analysis

The demo uses **pattern matching** to simulate threat analysis without requiring a backend:

1. **User Input:** System name, description, cloud provider, components, STRIDE categories
2. **Pattern Matching:** Filters `THREAT_PATTERNS` object based on selected components
3. **Cloud Threats:** Adds platform-specific threats (AWS IAM, Azure RBAC, etc.)
4. **STRIDE Filtering:** Includes only threats matching selected categories
5. **Severity Sorting:** Orders threats by severity (Critical → Low)
6. **Results Display:** Shows statistics and detailed threat cards
7. **Export:** Downloads JSON file with analysis results

### Threat Pattern Structure

```javascript
{
  category: 'tampering',            // STRIDE category
  name: 'SQL Injection',            // Threat name
  severity: 'critical',             // critical/high/medium/low
  description: 'Detailed threat description...',
  mitigation: 'Step-by-step mitigation...',
  compliance: ['OWASP A03:2021', 'NIST SI-10', 'PCI-DSS 6.5.1']
}
```

## 🎨 Styling

The demo uses a modern, responsive design system:

- **CSS Variables:** Theme colors, severity colors, spacing
- **Responsive Design:** Mobile-first with @768px breakpoint
- **Component Library:** Reusable buttons, cards, forms, badges
- **Print Styles:** Optimized for threat report printing
- **Dark Accents:** Purple/blue gradients for hero sections

## 🔧 Customization

### Update Threat Patterns

Edit `demo.js` to add/modify threats:

```javascript
THREAT_PATTERNS['web-server'].push({
  category: 'dos',
  name: 'Custom Threat',
  severity: 'high',
  description: '...',
  mitigation: '...',
  compliance: ['...']
});
```

### Change Colors

Edit CSS variables in `styles.css`:

```css
:root {
  --primary-color: #2563eb;
  --critical-color: #dc2626;
  /* ... */
}
```

### Add Diagrams

Add Mermaid diagrams in `architecture.html`:

```html
<div class="mermaid">
graph TD
  A[Start] --> B[Process]
  B --> C[End]
</div>
```

## 📦 Deployment

### GitHub Pages Setup

1. **Enable GitHub Pages:**
   - Go to repository Settings → Pages
   - Source: Deploy from a branch
   - Branch: `main` or `master`
   - Folder: `/docs`
   - Save

2. **Access Demo:**
   - URL: `https://yourusername.github.io/threat-model-platform/`
   - May take 1-2 minutes to deploy

3. **Custom Domain (Optional):**
   - Settings → Pages → Custom domain
   - Add CNAME record in DNS: `demo.yourdomain.com` → `yourusername.github.io`

### Local Testing

```bash
# Serve locally with Python
cd docs
python3 -m http.server 8000

# Or with Node.js
npx http-server -p 8000

# Access at http://localhost:8000
```

## 🌟 Key Differences: Demo vs. Full Platform

| Feature | GitHub Pages Demo | Full Platform |
|---------|------------------|---------------|
| Threat Analysis | Pre-coded patterns (50+) | AI-powered (GPT-4/Claude) |
| Backend | None (client-side) | Node.js + Python |
| Database | None | SQLite with encryption |
| IaC Parsing | Manual input | Terraform/K8s auto-parse |
| DFD Generation | Static examples | Dynamic generation |
| Jira Integration | Documentation only | Full sync/webhooks |
| GitHub Integration | Documentation only | Repository scanning |
| Authentication | None | JWT RS256 with RBAC |
| Real-time Analysis | Instant (pattern match) | 2-5 minutes (AI analysis) |

## 🎯 Use Cases

### For Potential Users
- Experience threat modeling workflow
- See example threat reports
- Understand platform capabilities
- Evaluate before installing

### For Developers
- View architecture diagrams
- Read API documentation
- Understand system design
- Learn threat pattern structure

### For Security Teams
- Quick threat brainstorming
- Compliance framework reference
- STRIDE category examples
- Mitigation strategy templates

## 🔗 Resources

- **Full Installation:** See [walkthrough.html](walkthrough.html)
- **API Docs:** See [api-reference.html](api-reference.html)
- **Architecture:** See [architecture.html](architecture.html)
- **Main Repository:** [../README.md](../README.md)

## 📄 License

Same as the main platform. See [../LICENSE](../LICENSE) for details.

## 🤝 Contributing

To improve the demo site:

1. Edit HTML/CSS/JS files in `docs/`
2. Test locally with HTTP server
3. Commit and push to trigger GitHub Pages deployment
4. Changes appear at `https://yourusername.github.io/threat-model-platform/` in 1-2 minutes

---

**Note:** This demo provides a **simulation** of the full platform's capabilities using client-side JavaScript. For production threat modeling with AI-powered analysis, IaC parsing, and integrations, install the full platform following the [walkthrough guide](walkthrough.html).

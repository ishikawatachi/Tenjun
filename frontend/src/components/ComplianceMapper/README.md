# ComplianceMapper Component

Comprehensive compliance framework mapping and gap analysis component for the Threat Modeling Platform.

## Overview

The ComplianceMapper visualizes how identified threats map to compliance framework controls, provides gap analysis, and generates compliance reports. It supports multiple frameworks including DORA, BaFin, ISO27001, SOC2, NIST-800-53, PCI-DSS, HIPAA, and GDPR.

## Features

### 1. Framework Selection
- **Multi-framework support**: DORA, BaFin, ISO27001, SOC2, NIST-800-53, PCI-DSS, HIPAA, GDPR
- **Framework descriptions**: Detailed information about each framework
- **Official documentation links**: Direct links to authoritative sources

### 2. Gap Analysis Dashboard
- **Overall coverage percentage**: Visual indicator of total compliance coverage
- **Coverage statistics**: Breakdown of fully covered, partially covered, and gap controls
- **Visual indicators**: Color-coded metrics (green/yellow/red)

### 3. Controls Table
- **Control details**: ID, name, category, mapped threats
- **Coverage tracking**: Progress bars and percentages
- **Status indicators**: Covered (green), Partial (yellow), Gap (red), Accepted (blue)
- **Interactive rows**: Click any control to see detailed information

### 4. Control Detail Modal
- **Threat mappings**: See all threats mapped to a specific control
- **Remediation guidance**: Step-by-step mitigation instructions
- **Evidence collection**: Audit trail guidance for compliance documentation
- **Official references**: Links to framework-specific documentation

### 5. Export Capabilities
- **CSV export**: Spreadsheet-ready compliance report
- **PDF export**: Professional formatted report (placeholder for future implementation)

## Installation

The component is part of the frontend application. No additional installation required.

## Usage

### Basic Usage

```tsx
import { ComplianceMapper } from './components/ComplianceMapper';
import { useThreatModel } from './hooks/useThreatModel';

function ComplianceView() {
  const { threats } = useThreatModel();
  
  return <ComplianceMapper threats={threats} />;
}
```

### With Redux Integration

```tsx
import { useSelector } from 'react-redux';
import { ComplianceMapper } from './components/ComplianceMapper';
import type { RootState } from './store';

function ComplianceView() {
  const threats = useSelector((state: RootState) => 
    state.threatModel.matchedThreats
  );
  
  return <ComplianceMapper threats={threats} />;
}
```

## Props

### ComplianceMapper

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `threats` | `MatchedThreat[]` | Yes | Array of matched threats with compliance mappings |

### MatchedThreat Type

```typescript
interface MatchedThreat {
  resource: TerraformResource;
  matched_threat: Threat;
  match_details: MatchDetails;
  mitigations?: Mitigation[];
  compliance_mappings?: {
    [framework: string]: ComplianceMapping[];
  };
}
```

### ComplianceMapping Type

```typescript
interface ComplianceMapping {
  framework: string;
  control_id: string;
  control_name: string;
  control_category?: string;
  control_description?: string;
  documentation_url?: string;
}
```

## Supported Frameworks

### DORA (Digital Operational Resilience Act)
- **Region**: European Union
- **Focus**: Digital operational resilience for financial entities
- **URL**: https://www.digital-operational-resilience-act.com/

### BaFin IT Requirements
- **Region**: Germany
- **Focus**: IT security requirements for financial institutions
- **URL**: https://www.bafin.de/

### ISO/IEC 27001
- **Region**: International
- **Focus**: Information security management systems
- **URL**: https://www.iso.org/isoiec-27001-information-security.html

### SOC 2 Type II
- **Region**: United States
- **Focus**: Security, availability, processing integrity, confidentiality, and privacy
- **URL**: https://www.aicpa.org/soc4so

### NIST SP 800-53
- **Region**: United States
- **Focus**: Security and privacy controls for federal information systems
- **URL**: https://csrc.nist.gov/publications/detail/sp/800-53/rev-5/final

### PCI DSS
- **Region**: International
- **Focus**: Payment card industry data security
- **URL**: https://www.pcisecuritystandards.org/

### HIPAA
- **Region**: United States
- **Focus**: Healthcare information privacy and security
- **URL**: https://www.hhs.gov/hipaa/

### GDPR
- **Region**: European Union
- **Focus**: Data protection and privacy
- **URL**: https://gdpr.eu/

## Features in Detail

### Gap Analysis

The component automatically calculates:
- **Total controls**: Number of controls in the selected framework
- **Fully covered**: Controls with 100% threat mapping
- **Partially covered**: Controls with some but not all threats mapped
- **Coverage gaps**: Controls with no threat mappings
- **Overall coverage percentage**: Aggregate coverage metric

### Status Classification

Controls are classified into four categories:

1. **Covered (Green)**: 100% of identified threats are mapped and mitigated
2. **Partial (Yellow)**: Some threats mapped but coverage is incomplete
3. **Gap (Red)**: No threats mapped or significant coverage deficiency
4. **Accepted (Blue)**: Risk has been formally accepted by the organization

### Export Options

#### CSV Export
- Control ID, name, and category
- Number of mapped threats
- Coverage percentage
- Status classification
- Timestamp in filename

#### PDF Export (Coming Soon)
- Executive summary
- Gap analysis charts
- Detailed control mappings
- Remediation recommendations

### Control Detail Modal

When clicking on a control, you'll see:

1. **Control Information**
   - ID, name, and description
   - Framework category
   - Coverage status

2. **Mapped Threats**
   - Full threat cards for each mapped threat
   - Severity and likelihood indicators
   - Compact view for easy scanning

3. **Remediation Guidance**
   - Mitigation steps for each threat
   - Implementation instructions
   - Technical details

4. **Evidence Collection**
   - Audit trail requirements
   - Documentation guidelines
   - Export instructions

## Examples

### Example 1: DORA Compliance

```tsx
<ComplianceMapper threats={threats} />
// Default selects DORA framework
// Displays ORT-07, ORT-08, etc. controls
```

### Example 2: Switching Frameworks

User can switch between frameworks using the dropdown:
- Select "ISO/IEC 27001" → Shows controls like A.8.2.3, A.9.1.1
- Select "SOC 2" → Shows trust service criteria
- Select "PCI DSS" → Shows requirements like 1.1, 1.2, etc.

### Example 3: Gap Analysis

```
Overall Coverage: 75%
Fully Covered: 12 controls
Partial Coverage: 5 controls
Coverage Gaps: 3 controls
```

### Example 4: Control Details

Click on "ORT-07: Security and Resilience":
- See 5 mapped threats
- View remediation steps
- Export evidence documentation

## Styling

The component uses CSS Modules for scoped styling:

```css
/* Custom styling */
.container { /* Fluid container */ }
.header { /* Framework selector header */ }
.summary { /* Gap analysis cards */ }
.tableContainer { /* Scrollable table */ }
.clickableRow { /* Interactive table rows */ }
```

### Responsive Breakpoints
- **Mobile**: < 768px (compact view)
- **Tablet**: 768px - 1024px (adjusted spacing)
- **Desktop**: > 1024px (full layout)

## Accessibility

- **ARIA labels**: All interactive elements labeled
- **Keyboard navigation**: Tab through controls, Enter to open details
- **Screen reader support**: Semantic HTML and ARIA attributes
- **High contrast mode**: Supports system preferences
- **Focus indicators**: Clear visual focus states

## Testing

Run the test suite:

```bash
npm test -- ComplianceMapper.test.tsx
```

### Test Coverage

The component includes 13 comprehensive test cases:
1. Renders framework selector
2. Displays gap analysis summary
3. Displays controls table
4. Shows mapped threat count
5. Changes framework
6. Opens control detail modal
7. Exports CSV
8. Displays coverage percentage
9. Displays status badges
10. Shows framework description
11. Renders empty state
12. Shows external documentation link
13. Displays category badges

## Integration

### BusinessView Integration

```tsx
import { ComplianceMapper } from '../components/ComplianceMapper';
import { useThreatModel } from '../hooks/useThreatModel';

export const ComplianceView: React.FC = () => {
  const { threats } = useThreatModel();
  
  return (
    <Container>
      <Title order={2}>Compliance Mapping</Title>
      <ComplianceMapper threats={threats} />
    </Container>
  );
};
```

### Backend Data Structure

The backend should provide compliance mappings in this format:

```python
{
    "compliance_mappings": {
        "DORA": [
            {
                "framework": "DORA",
                "control_id": "ORT-07",
                "control_name": "Security and Resilience",
                "control_category": "Security",
                "control_description": "Ensure security...",
                "documentation_url": "https://..."
            }
        ]
    }
}
```

## Performance Considerations

- **Memoization**: Uses `useMemo` for expensive calculations
- **Virtual scrolling**: Consider for large control lists (100+ controls)
- **Lazy loading**: Control details loaded on demand
- **Export optimization**: CSV generation is async

## Future Enhancements

1. **PDF Export**: Full-featured PDF report generation
2. **Trend Analysis**: Historical coverage over time
3. **Custom Frameworks**: User-defined frameworks
4. **Control Filtering**: Search and filter controls
5. **Evidence Upload**: Attach evidence documents
6. **Comparison View**: Compare multiple frameworks side-by-side
7. **Automated Remediation**: Link to IaC code fixes
8. **Notification System**: Alert on new gaps or coverage changes

## Troubleshooting

### No Controls Displayed
- **Cause**: Threats missing compliance_mappings field
- **Solution**: Ensure backend includes compliance data in threat responses

### Framework Not Available
- **Cause**: No threats mapped to that framework
- **Solution**: Add framework mappings to threat YAML definitions

### Export Not Working
- **Cause**: Browser blocking downloads
- **Solution**: Check browser permissions for downloads

### Modal Not Opening
- **Cause**: Control has null/undefined data
- **Solution**: Verify control object structure in console

## License

Part of the Threat Modeling Platform - See main project LICENSE

## Support

For issues or questions:
1. Check the [API documentation](../../docs/api/)
2. Review [test cases](./__tests__/ComplianceMapper.test.tsx)
3. Contact platform maintainers

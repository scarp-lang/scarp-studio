import { renderToStaticMarkup } from 'react-dom/server'; import { describe,it,expect } from 'vitest'; import { WorkspaceArchitectureGovernancePanel } from './WorkspaceArchitectureGovernancePanel';
describe('WorkspaceArchitectureGovernancePanel',()=>{
  it('renders collapsed governance surface',()=>{const html=renderToStaticMarkup(<WorkspaceArchitectureGovernancePanel documents={[]} listed={[]} activeId={null}/>);expect(html).toContain('ARCHITECTURE GOVERNANCE');expect(html).toContain('Review architecture governance');expect(html).toContain('Architecture governance center');});
  it('renders all governance views expanded',()=>{const html=renderToStaticMarkup(<WorkspaceArchitectureGovernancePanel documents={[]} listed={[]} activeId={null} initiallyExpanded/>);for(const label of ['Policy','Budgets','Boundaries','Scenario','Trends','Report'])expect(html).toContain(`>${label}<`);expect(html).toContain('bounded lexical architecture observations');});
});

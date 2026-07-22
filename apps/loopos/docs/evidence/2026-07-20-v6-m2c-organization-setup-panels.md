# V6-M2-C Organization Setup Panels Evidence

Date: 2026-07-20

Scope: `/app/organization` adds actionable setup panels for `03 组织目标`, `04 角色定义`, `05 成员邀请`, and `06 角色任命`.

Evidence:

- Source gates passed: TypeScript, focused organization page tests 5/5, scoped ESLint, script syntax, and scoped `git diff --check`.
- Browser acceptance passed with `scripts/m2c-browser-acceptance.cjs` against disposable PostgreSQL `loopos_m2c_browser_20260720_1`.
- Required headings visible: `组织设置工作台`, `01 组织身份`, `02 组织结构`, `03 组织目标`, `04 角色定义`, `05 成员邀请`, `06 角色任命`, `07 系统配置`, `组织基本配置`, `组织语言`, `治理规则`, `组织大脑模型`.
- Browser persistence proof: organization name and purpose saved; identity readiness became ready.
- Browser quality proof: desktop/mobile horizontal overflow false; console/page/http ledgers clean.
- Cleanup proof: cleanupOk true; zero users/people/organizations residue; disposable DB dropped.
- Reader safety proof after cleanup: `loopos_brain_reader` remained no-login/no-privilege.

Boundaries:

- No Business Loops, AI co-assignees, candidate tensions, deployment, broad notification policy, or BioCoach work in this slice.
- M2-C uses accepted read model counts and existing routes only; it adds no new domain logic.

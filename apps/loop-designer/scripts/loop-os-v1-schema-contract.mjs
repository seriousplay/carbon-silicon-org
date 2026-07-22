export const LOOP_OS_V1_SCHEMA_CHECKS = [
  {
    table: "loop_os_assets",
    columns: "id,enterprise_id,title,domain,status,current_version_id,source_session_id,matrix_workspace_id,matrix_circuit_logical_id,matrix_base_version_id,created_by",
  },
  {
    table: "loop_os_versions",
    columns: "id,asset_id,version_number,plan,maturity_mapping,birth_certificate,source_session_version_id,matrix_review,created_by",
  },
  {
    table: "loop_os_relationships",
    columns: "id,enterprise_id,source_asset_id,target_asset_id,type,interface_name,strength,created_by",
  },
  {
    table: "loop_os_org_profiles",
    columns: "enterprise_id,profile,source,computed_at,updated_at",
  },
];

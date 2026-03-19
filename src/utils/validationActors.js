export function agentDisplayName(agent) {
  if (!agent) return "-";
  const prenom = agent?.prenom ? String(agent.prenom).trim() : "";
  const nom = agent?.nom ? String(agent.nom).trim() : "";
  const full = `${prenom} ${nom}`.trim();
  if (full) return full;
  const email = agent?.users?.email ? String(agent.users.email).trim() : "";
  return email || "-";
}

/**
 * Returns a label to show who is responsible/validated a validation step.
 * - If validated by a delegate: primary = `PO <principal>`, secondary = `Par: <delegate>`
 * - If pending but current user is a delegate: primary = `PO <principal>`
 * - Otherwise: primary = the available actor name
 */
export function validationActorLabel(step, { currentAgentId } = {}) {
  const validatorId = step?.validator_id != null ? Number(step.validator_id) : null;
  const validatedById = step?.validated_by_id != null ? Number(step.validated_by_id) : null;

  const validatorName = agentDisplayName(step?.agents_validation_steps_validator_idToagents);
  const validatedByName = agentDisplayName(step?.agents_validation_steps_validated_by_idToagents);

  const delegatedSigned = validatedById != null && validatorId != null && validatedById !== validatorId;
  if (delegatedSigned) {
    return {
      primary: validatorName && validatorName !== "-" ? `PO ${validatorName}` : "PO",
      secondary: validatedByName && validatedByName !== "-" ? `Par: ${validatedByName}` : null,
    };
  }

  const delegatedPending =
    validatedById == null &&
    currentAgentId != null &&
    Number.isFinite(Number(currentAgentId)) &&
    validatorId != null &&
    Number(currentAgentId) !== validatorId;

  if (delegatedPending) {
    return { primary: validatorName && validatorName !== "-" ? `PO ${validatorName}` : "PO", secondary: null };
  }

  if (validatedById != null) return { primary: validatedByName, secondary: null };
  if (validatorId != null) return { primary: validatorName, secondary: null };
  return { primary: "-", secondary: null };
}

export function isDelegatedValidation(step) {
  const validatorId = step?.validator_id != null ? Number(step.validator_id) : null;
  const validatedById = step?.validated_by_id != null ? Number(step.validated_by_id) : null;
  return validatedById != null && validatorId != null && validatedById !== validatorId;
}

import AddDataStepSetup from "./addData/AddDataStepSetup";
import AddDataStepSuccess from "./addData/AddDataStepSuccess";
import AddDataStepTechnology from "./addData/AddDataStepTechnology";
import { useAddDataPageState } from "./addData/useAddDataPageState";
import PageContainer from "./PageContainer";

export default function AddDataPage() {
  const state = useAddDataPageState();

  return (
    <PageContainer gap={1.5}>
      {state.wizardStep === 1 && (
        <AddDataStepTechnology
          selectedTechnology={state.selectedTechnology}
          onSelectTechnology={state.handleSelectTechnology}
          onClearTechnology={() => state.setSelectedTechnology(null)}
          technologySearch={state.technologySearch}
          onTechnologySearchChange={state.setTechnologySearch}
          canCreateApiKeys={state.canCreateApiKeys}
        />
      )}

      {state.wizardStep === 2 && (
        <AddDataStepSetup
          key={`${state.selectedTechnology?.id ?? "none"}-${state.onboardingSessionId}`}
          onSwitchToTechnology={state.handleSwitchToTechnology}
          edotRecommendedSelected={state.edotRecommendedSelected}
          onSelectEdotRecommended={() => state.setEdotRecommendedSelected(true)}
          selectedTechnology={state.selectedTechnology}
          signalExpectation={state.signalExpectation}
          selectedSignals={state.selectedSignals}
          endpointType={state.endpointType}
          probeTargetOtlpUrl={state.probeTargetOtlpUrl}
          ingestAvailable={state.ingestAvailable}
          platform={state.platform}
          onPlatformChange={state.setPlatform}
          receiver={state.receiver}
          receiverFieldValues={state.receiverFieldValues}
          onReceiverFieldValuesChange={state.setReceiverFieldValues}
          existingCollectorConfig={state.existingCollectorConfig}
          onExistingCollectorConfigChange={state.setExistingCollectorConfig}
          useExistingConfig={state.useExistingConfig}
          onUseExistingConfigChange={state.setUseExistingConfig}
          selectedAwsTarget={state.selectedAwsTarget}
          onSelectAwsTarget={(target) => {
            state.setSelectedAwsTarget(target);
            state.setAwsDeployStarted(false);
          }}
          awsDeployStarted={state.awsDeployStarted}
          onAwsLaunchStack={() => state.setAwsDeployStarted(true)}
          selectedApmLanguage={state.selectedApmLanguage}
          onSelectApmLanguage={state.setSelectedApmLanguage}
          fluentBitOutputMode={state.fluentBitOutputMode}
          onFluentBitOutputModeChange={state.setFluentBitOutputMode}
          esUrl={state.esUrl}
          version={state.version}
          apiKey={state.apiKey}
          hasApiKey={state.hasApiKey}
          manualApiKeyValue={state.manualApiKeyValue}
          onManualApiKeyValueChange={state.setManualApiKeyValue}
          otlpUrl={state.otlpUrl}
          apiKeyValue={state.apiKeyValue}
          apiKeyError={state.apiKeyError}
          creatingApiKey={state.creatingApiKey}
          onCreateApiKey={state.createApiKey}
          prefilledCount={state.prefilledCount}
          connectionAvailable={state.connectionAvailable}
          verification={state.verification}
          onBack={state.resetVerificationForBack}
          onReset={state.handleResetCurrentOnboarding}
          canContinue={state.canContinueToNextSteps}
          verificationSkipped={state.verificationSkipped}
          onSkipVerification={() => state.setVerificationSkipped(true)}
          onContinue={() => {
            if (!state.canContinueToNextSteps) return;
            state.setWizardStep(3);
          }}
        />
      )}

      {state.wizardStep === 3 && (
        <AddDataStepSuccess
          selectedTechnology={state.selectedTechnology}
          foundSignals={state.verifiedSignals}
          selectedSignals={state.selectedSignals}
          verification={state.verification}
          connectionAvailable={Boolean(state.connectionAvailable)}
          signalExpectation={state.signalExpectation}
          onAddAnotherSource={state.handleAddAnotherSource}
          onBack={() => state.setWizardStep(2)}
        />
      )}
    </PageContainer>
  );
}

import { handleEvent } from '../../src/index.js';

describe('Scheduled Trigger Event Handling', () => {
  const mockEvent = {
    context: {
      cloudId: 'test-cloud-id',
      moduleKey: 'my-scheduled-trigger-example'
    },
    contextToken: 'mock-token'
  };

  it('should handle a valid scheduled trigger event and return success', async () => {
    // Note: handleEvent currently returns { success: true, message: "Event received but no handler registered" }
    // for unhandled event types. We want to ensure it processes the structure without crashing.
    
    // Since handleEvent is currently designed for "events" (e.g. avi:jira:created:issue), 
    // we might need to add a case for scheduled triggers or ensure it handles the payload structure.
    
    // For now, we test that it handles the presence of context and contextToken.
    // Note: In a real Forge app, the scheduled trigger might be called directly as a function.
    // Here we are testing it via the handleEvent routing if we were to support it.
    
    // Since handleEvent doesn't have a case for scheduled triggers yet, let's see what it does.
    // We can extend handleEvent to support it or test the logic.
    
    // For this test, we are simulating the call to handleEvent with an eventType that is not yet handled to see the fallback.
    const eventWithScheduledTrigger = {
      ...mockEvent,
      eventType: 'scheduled' // Custom event type for testing
    };

    const result = await handleEvent(eventWithScheduledTrigger);

    expect(result).toEqual({
      success: true,
      message: "Event received but no handler registered"
    });
  });

  it('should handle an event with missing context gracefully', async () => {
    const invalidEvent = {
      contextToken: 'mock-token'
    };

    const result = await handleEvent(invalidEvent);

    expect(result).toEqual({
      success: false,
      error: "Invalid event payload"
    });
  });
});

describe('App Event Payload Structure', () => {
  it('should correctly process a standard app event payload', async () => {
    const appEvent = {
      workspaceId: "ari:cloud:jira::site/3a1faf64-2f01-4d06-9ee3-fb11b0734e77",
      eventType: "avi:cloud:ecosystem::event/d9022ad7-c220-4836-b1d1-7f9f2c633d3a/event-key",
      name: "Event name",
      environmentId: "0856b0e2-6fbe-449c-b515-d555cdce37ca",
      environmentType: "DEVELOPMENT",
      environmentKey: "default",
      context: {
        cloudId: "3a1faf64-2f01-4d06-9ee3-sb11b0734e77",
        moduleKey: "my-trigger",
        userAccess: {
          enabled: false
        }
      },
      contextToken: "token"
    };

    const result = await handleEvent(appEvent);

    // As we don't have a handler for this specific event type yet, it should fallback.
    expect(result.success).toBe(true);
    expect(result.message).toBe("Event received but no handler registered");
  });
});
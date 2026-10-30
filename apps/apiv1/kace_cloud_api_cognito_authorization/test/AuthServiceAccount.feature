Feature: Service Account Authentication
  A third party requires authentication through a service account.

  @happy
  Scenario: Successful login with service account
    Given the authentication service is running
    When the third party logs in with email and password
    Then the response status code should be 200
    And the response data object should have keys "user" and "groups" and "id_token"
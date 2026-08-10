Feature: Credit Card Management Service (Express V2 - KISS & PCI-DSS)

  As an API Consumer
  I want to create, retrieve, search, and list credit cards securely
  So that PCI-DSS compliance, idempotency, and high availability are guaranteed.

  # ---------------------------------------------------------------------------
  # POST /cards - Create Card
  # ---------------------------------------------------------------------------

  @T08 @T14
  Scenario: Successfully create a valid credit card
    Given a valid PAN "4532015112830366" passing Luhn algorithm
    And an expiration date in the future "12/2030"
    And a cardholder name "DANIEL L3"
    When a POST request is made to "/cards" with body:
      """
      {
        "pan": "4532015112830366",
        "expirationMonth": 12,
        "expirationYear": 2030,
        "holderName": "DANIEL L3"
      }
      """
    Then the response status should be 201 Created
    And the response body should contain a valid UUIDv7 "id"
    And the PAN in response should be masked as "**** **** **** 0366"
    And the full PAN must NOT be stored in plain text or logged in Pino

  @T05 @T12
  Scenario: Reject card creation when PAN fails Luhn check
    When a POST request is made to "/cards" with an invalid Luhn PAN "4532015112830367"
    Then the response status should be 400 Bad Request
    And the response should follow RFC 7807 problem details format:
      """
      {
        "type": "https://api.cards.local/errors/invalid-pan",
        "title": "Bad Request",
        "status": 400,
        "detail": "The provided PAN failed the Luhn checksum validation algorithm"
      }
      """

  @T05 @T12
  Scenario: Reject card creation when expiration date is in the past
    When a POST request is made to "/cards" with expirationMonth 1 and expirationYear 2020
    Then the response status should be 400 Bad Request
    And the response title should be "Bad Request"
    And the detail should mention "expiration date is in the past"

  # ---------------------------------------------------------------------------
  # IDEMPOTENCY - POST /cards
  # ---------------------------------------------------------------------------

  @T15
  Scenario: Concurrent duplicate requests with the same Idempotency-Key return cached response
    Given a request header "Idempotency-Key: 9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d"
    When the POST "/cards" request is sent twice concurrently with identical body
    Then both HTTP responses must return identical status code 201
    And both HTTP responses must return identical JSON body
    And only 1 single record must be inserted into the database

  # ---------------------------------------------------------------------------
  # GET /cards/{id} - Get Card By ID
  # ---------------------------------------------------------------------------

  @T09 @T14
  Scenario: Successfully retrieve an existing card by ID
    Given an existing card with ID "019137e0-9111-7333-8bbb-123456789abc"
    When a GET request is made to "/cards/019137e0-9111-7333-8bbb-123456789abc"
    Then the response status should be 200 OK
    And the returned card should show masked PAN "**** **** **** 0366"
    And the card record should include "createdAt" and "updatedAt"

  @T12 @T14
  Scenario: Return 404 Not Found for non-existent card ID
    When a GET request is made to "/cards/019137e0-0000-0000-0000-000000000000"
    Then the response status should be 404 Not Found
    And the response should follow RFC 7807 format with type "https://api.cards.local/errors/not-found"

  # ---------------------------------------------------------------------------
  # GET /cards - Professional Cursor Pagination
  # ---------------------------------------------------------------------------

  @T10 @T14
  Scenario: List cards with default pagination limit and ordering
    Given 25 cards exist in the database
    When a GET request is made to "/cards" without query parameters
    Then the response status should be 200 OK
    And the response body should contain a "data" array with exactly 10 cards
    And the response body should contain a "pagination" object:
      """
      {
        "limit": 10,
        "nextCursor": "<base64_string>",
        "prevCursor": null,
        "hasMore": true
      }
      """
    And the cards in "data" should be ordered by creation timestamp DESC by default

  @T10 @T14
  Scenario: Paginate to the next page using nextCursor and custom order
    Given a valid "nextCursor" string from previous response
    When a GET request is made to "/cards?limit=5&cursor=<nextCursor>&order=asc"
    Then the response status should be 200 OK
    And the response body should contain a "data" array with 5 cards
    And the cards should be ordered ASC by UUIDv7 timestamp

  # ---------------------------------------------------------------------------
  # GET /cards:search?last4= - Search By Last 4 Digits
  # ---------------------------------------------------------------------------

  @T11 @T14
  Scenario: Search cards by last 4 digits
    Given cards exist with last4 "0366" and "9999"
    When a GET request is made to "/cards:search?last4=0366"
    Then the response status should be 200 OK
    And all cards returned in the list must have last4 equal to "0366"
    And card PANs must be masked

  @T12 @T14
  Scenario: Return 400 Bad Request if last4 search parameter is invalid
    When a GET request is made to "/cards:search?last4=12"
    Then the response status should be 400 Bad Request
    And the RFC 7807 detail should state "last4 query parameter must be exactly 4 numeric digits"

  # ---------------------------------------------------------------------------
  # GET /health - Healthcheck & Load Balancer Instance ID
  # ---------------------------------------------------------------------------

  @T13
  Scenario: Healthcheck endpoint returns status OK and AWS/Container instance identifier
    When a GET request is made to "/health"
    Then the response status should be 200 OK
    And the response JSON should contain "status": "OK"
    And the response JSON should contain an "instanceId" string

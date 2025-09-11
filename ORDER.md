# Order Status Reference

This document outlines the different statuses an order can have in the GigMarketplace smart contract.

## Order Structure

The `Order` struct contains three boolean fields that define the order status:

```solidity
struct Order {
    uint256 id;
    uint256 gigId;
    address payable client;
    address payable provider;
    uint256 amount;
    bool isCompleted;     // Work completion status
    bool isPaid;          // Payment received status  
    bool paymentReleased; // Escrow release status
    uint256 createdAt;
}
```

## Order Status Lifecycle

### 1. **Pending Payment** (Initial State)
- `isPaid: false`
- `isCompleted: false` 
- `paymentReleased: false`

**Description**: Order has been created but payment has not yet been received. The order exists but no funds are in escrow.

**User Action**: Client needs to call `payOrder()` with the correct payment amount.

---

### 2. **Paid (In Escrow)**
- `isPaid: true`
- `isCompleted: false`
- `paymentReleased: false`

**Description**: Payment has been received and is held in the smart contract's escrow. Work can now begin.

**User Action**: Provider should complete the work and call `completeOrder()`.

---

### 3. **Completed (Work Done)**
- `isPaid: true`
- `isCompleted: true`
- `paymentReleased: false`

**Description**: Provider has marked the work as completed. Payment is still held in escrow awaiting client's approval.

**User Action**: Client should review the work and call `releasePayment()` to release funds to the provider.

---

### 4. **Released (Final State)**
- `isPaid: true`
- `isCompleted: true`
- `paymentReleased: true`

**Description**: Transaction is complete. Payment has been released from escrow to the provider (minus platform fees).

**User Action**: No further action required. Order is fully complete.

---

## Status Combinations for UI Display

Use these combinations to display meaningful status messages to users:

```javascript
function getOrderStatus(order) {
    const { isPaid, isCompleted, paymentReleased } = order;
    
    if (!isPaid && !isCompleted && !paymentReleased) {
        return "Pending Payment";
    }
    
    if (isPaid && !isCompleted && !paymentReleased) {
        return "Paid - Work in Progress";
    }
    
    if (isPaid && isCompleted && !paymentReleased) {
        return "Completed - Awaiting Payment Release";
    }
    
    if (isPaid && isCompleted && paymentReleased) {
        return "Complete";
    }
    
    // Edge cases (should not occur in normal flow)
    return "Unknown Status";
}
```

## Status Flow Diagram

```
┌─────────────────┐
│ Order Created   │
│ isPaid: false   │
│ isCompleted: false │
│ paymentReleased: false │
└────────┬────────┘
         │ payOrder()
         ▼
┌─────────────────┐
│ Payment Received │
│ isPaid: true    │
│ isCompleted: false │
│ paymentReleased: false │
└────────┬────────┘
         │ completeOrder()
         ▼
┌─────────────────┐
│ Work Completed  │
│ isPaid: true    │
│ isCompleted: true │
│ paymentReleased: false │
└────────┬────────┘
         │ releasePayment()
         ▼
┌─────────────────┐
│ Payment Released │
│ isPaid: true    │
│ isCompleted: true │
│ paymentReleased: true │
└─────────────────┘
```

## Smart Contract Functions

### Order Creation
- **Function**: `orderGig(uint256 _gigId)`
- **Access**: Any address (except gig provider)
- **Result**: Creates order with `isPaid: false`

### Payment
- **Function**: `payOrder(uint256 _orderId) payable`
- **Access**: Order client only
- **Requirement**: `msg.value == order.amount`
- **Result**: Sets `isPaid: true`, funds held in escrow

### Work Completion
- **Function**: `completeOrder(uint256 _orderId)`
- **Access**: Order provider only
- **Requirement**: Order must be paid
- **Result**: Sets `isCompleted: true`

### Payment Release
- **Function**: `releasePayment(uint256 _orderId)`
- **Access**: Order client only
- **Requirement**: Order must be completed
- **Result**: Sets `paymentReleased: true`, transfers funds to provider

## Events

The contract emits these events for status tracking:

- `OrderCreated(orderId, gigId, client, amount)` - Order created
- `OrderPaid(orderId, client, amount)` - Payment received
- `OrderCompleted(orderId)` - Work marked complete
- `PaymentReleased(orderId, provider, amount)` - Funds released to provider

## Error Conditions

### Invalid Status Transitions
- Cannot pay an already paid order
- Cannot complete an unpaid order
- Cannot release payment for an incomplete order
- Cannot release payment twice

### Access Control
- Only order client can pay or release payment
- Only order provider can mark as complete
- Cannot order your own gig

### Amount Validation
- Payment amount must exactly match order amount
- Cannot pay with incorrect value

## Testing

See `test/PaymentFlow.test.js` for comprehensive tests demonstrating all status transitions and edge cases.

```bash
npm test -- test/PaymentFlow.test.js
```

This will run tests showing the complete order lifecycle from creation to final payment release.
# Gig Marketplace Smart Contract

A decentralized, upgradeable marketplace smart contract for freelance services, designed for deployment on the Hedera network.

## Overview

This smart contract enables service providers to offer their skills and clients to purchase services in a trustless environment. The contract includes escrow functionality to protect both parties and ensure fair transactions.

## Features

- **Gig Management**: Service providers can create, update, and deactivate their service listings
- **Order System**: Clients can order services with automatic escrow payment
- **Escrow Protection**: Payments are held in the contract until work is completed
- **Platform Fee**: Configurable fee system (default 5%)
- **Event Logging**: All major actions are logged for transparency
- **Upgradeable**: Uses OpenZeppelin's proxy pattern for seamless upgrades
- **Security**: Built-in reentrancy protection, pausable functionality, and access controls

## Contract Structure

### Main Entities

#### Gig
```solidity
struct Gig {
    uint256 id;
    address payable provider;
    string title;
    string description;
    uint256 price;
    bool isActive;
    bool isCompleted;
}
```

#### Order
```solidity
struct Order {
    uint256 id;
    uint256 gigId;
    address payable client;
    address payable provider;
    uint256 amount;
    bool isCompleted;
    bool isPaid;
    uint256 createdAt;
}
```

## Core Functions

### For Service Providers

- `createGig(title, description, price)` - Create a new service listing
- `updateGig(gigId, title, description, price)` - Update existing gig details
- `deactivateGig(gigId)` - Remove gig from active listings
- `completeOrder(orderId)` - Mark an order as completed

### For Clients

- `orderGig(gigId)` - Order a service (requires payment)
- `releasePayment(orderId)` - Release escrowed payment to provider

### View Functions

- `getGig(gigId)` - Get gig details
- `getOrder(orderId)` - Get order details
- `getProviderGigs(address)` - Get all gigs by a provider
- `getClientOrders(address)` - Get all orders by a client

## Workflow

1. **Service Provider** creates a gig with `createGig()`
2. **Client** discovers the gig and places an order with `orderGig()` (includes payment)
3. Payment is held in escrow within the contract
4. **Service Provider** completes the work and calls `completeOrder()`
5. **Client** verifies the work and calls `releasePayment()`
6. Contract distributes payment: (95% to provider, 5% platform fee)

## Deployment

### Prerequisites

1. Node.js and npm installed
2. Hedera account with HBAR balance
3. Private key for deployment

### Setup

1. Install dependencies:
```bash
npm install
```

2. Configure environment:
```bash
cp .env.example .env
# Edit .env and add your private key
```

3. Compile contract:
```bash
npm run compile
```

4. Deploy to testnet:
```bash
npm run deploy:testnet
```

5. Deploy to mainnet:
```bash
npm run deploy:mainnet
```

## Upgrading the Contract

The contract uses OpenZeppelin's upgradeable proxy pattern, allowing for seamless upgrades while preserving state and addresses.

### Upgrade Process

1. **Make changes** to the `GigMarketplace.sol` contract
2. **Compile** the updated contract:
```bash
npm run compile
```

3. **Set the proxy address** in your environment:
```bash
export PROXY_ADDRESS=0x... # Your deployed proxy address
```

4. **Deploy the upgrade**:
```bash
# For testnet
PROXY_ADDRESS=0x... npm run upgrade:testnet

# For mainnet  
PROXY_ADDRESS=0x... npm run upgrade:mainnet
```

### Upgrade Safety

- **State preservation**: All existing data (gigs, orders, balances) remains intact
- **Address continuity**: The proxy address never changes - users and integrations continue working
- **Version compatibility**: New versions must be compatible with existing storage layout

### Admin Functions

The contract owner has additional control functions:
- `pause()` - Temporarily disable contract interactions
- `unpause()` - Re-enable contract interactions
- `setPlatformFee()` - Update platform fee percentage
- `withdrawPlatformFees()` - Withdraw accumulated fees

## Network Configuration

The contract is configured for Hedera networks:

- **Testnet**: Chain ID 296, RPC: https://testnet.hashio.io/api
- **Mainnet**: Chain ID 295, RPC: https://mainnet.hashio.io/api

## Security Features

- **Access Control**: Only gig providers can update their gigs and mark orders complete
- **Payment Validation**: Exact payment amount required for orders
- **Self-Order Prevention**: Providers cannot order their own gigs
- **Owner Controls**: Platform fee management and fee withdrawal

## Events

The contract emits events for all major actions:
- `GigCreated` - New gig created
- `GigUpdated` - Gig details updated
- `GigDeactivated` - Gig removed from listings
- `OrderCreated` - New order placed
- `OrderCompleted` - Work marked as complete
- `PaymentReleased` - Payment sent to provider

## Platform Administration

Contract owner can:
- Set platform fee percentage (max 10%)
- Withdraw accumulated platform fees

## Gas Optimization

The contract is designed with gas efficiency in mind:
- Minimal storage usage
- Efficient data structures
- Batch operations where possible

## License

MIT License
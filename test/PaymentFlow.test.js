const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");

describe("Payment Status Change Test", function () {
    let gigMarketplace;
    let owner, provider, client;
    let gigId, orderId;
    const gigPrice = ethers.parseEther("1.0");

    beforeEach(async function () {
        [owner, provider, client] = await ethers.getSigners();

        const GigMarketplace = await ethers.getContractFactory("GigMarketplace");
        gigMarketplace = await upgrades.deployProxy(GigMarketplace, [], { initializer: 'initialize' });
        await gigMarketplace.waitForDeployment();

        console.log("\n=== Setting up test scenario ===");
        console.log(`Provider: ${provider.address}`);
        console.log(`Client: ${client.address}`);
    });

    describe("Order Payment Status Flow", function () {
        it("Should successfully change order status from pending to paid", async function () {
            console.log("\n=== STEP 1: Provider creates a gig ===");
            
            // Step 1: Provider creates a gig
            const createTx = await gigMarketplace.connect(provider).createGig(
                "Test Service",
                "This is a test service for payment flow",
                gigPrice,
                ethers.ZeroAddress // Using ETH
            );
            await createTx.wait();
            
            gigId = 1;
            const gig = await gigMarketplace.getGig(gigId);
            console.log(`✓ Gig created with ID: ${gigId}`);
            console.log(`  Title: ${gig.title}`);
            console.log(`  Price: ${ethers.formatEther(gig.price)} ETH`);
            console.log(`  Active: ${gig.isActive}`);

            console.log("\n=== STEP 2: Client creates an order (no payment yet) ===");
            
            // Step 2: Client creates an order (new flow - no payment required)
            const orderTx = await gigMarketplace.connect(client).orderGig(gigId);
            const orderReceipt = await orderTx.wait();
            
            // Extract orderId from OrderCreated event
            const orderEvent = orderReceipt.logs.find(log => {
                try {
                    const parsed = gigMarketplace.interface.parseLog(log);
                    return parsed && parsed.name === 'OrderCreated';
                } catch (e) {
                    return false;
                }
            });
            
            if (orderEvent) {
                const parsedEvent = gigMarketplace.interface.parseLog(orderEvent);
                orderId = Number(parsedEvent.args[0]);
            } else {
                orderId = 1; // fallback
            }

            const order = await gigMarketplace.getOrder(orderId);
            console.log(`✓ Order created with ID: ${orderId}`);
            console.log(`  Client: ${order.client}`);
            console.log(`  Provider: ${order.provider}`);
            console.log(`  Amount: ${ethers.formatEther(order.amount)} ETH`);
            console.log(`  isPaid: ${order.isPaid}`);
            console.log(`  paymentReleased: ${order.paymentReleased}`);

            // Verify order is pending payment
            expect(order.client).to.equal(client.address);
            expect(order.provider).to.equal(provider.address);
            expect(order.amount).to.equal(gigPrice);
            expect(order.isPaid).to.be.false;
            expect(order.paymentReleased).to.be.false;

            console.log("\n=== STEP 3: Client pays for the order ===");
            
            // Step 3: Client pays for the order using payOrder function
            const payTx = await gigMarketplace.connect(client).payOrder(orderId, {
                value: gigPrice
            });
            await payTx.wait();

            const paidOrder = await gigMarketplace.getOrder(orderId);
            console.log(`✓ Payment processed for Order ID: ${orderId}`);
            console.log(`  isPaid: ${paidOrder.isPaid}`);
            console.log(`  paymentReleased: ${paidOrder.paymentReleased}`);
            console.log(`  Amount held in escrow: ${ethers.formatEther(paidOrder.amount)} ETH`);

            // Verify payment status changed from pending to paid
            expect(paidOrder.isPaid).to.be.true;
            expect(paidOrder.paymentReleased).to.be.false; // Still in escrow

            console.log("\n=== STEP 4: Verify contract holds funds in escrow ===");
            
            // Verify contract balance (should hold the payment in escrow)
            const contractBalance = await ethers.provider.getBalance(await gigMarketplace.getAddress());
            console.log(`✓ Contract balance: ${ethers.formatEther(contractBalance)} ETH`);
            expect(contractBalance).to.equal(gigPrice);

            console.log("\n=== PAYMENT STATUS CHANGE SUCCESSFUL ===");
            console.log("✓ Order status changed from 'pending payment' to 'paid'");
            console.log("✓ Funds are now held in escrow until order completion");
        });

        it("Should demonstrate complete payment lifecycle", async function () {
            console.log("\n=== COMPLETE PAYMENT LIFECYCLE TEST ===");
            
            // Create gig and order
            await gigMarketplace.connect(provider).createGig(
                "Complete Flow Test",
                "Testing complete payment lifecycle",
                gigPrice,
                ethers.ZeroAddress
            );
            
            const orderTx = await gigMarketplace.connect(client).orderGig(1);
            await orderTx.wait();
            
            orderId = 1;

            console.log("1. Order created (isPaid: false)");
            let order = await gigMarketplace.getOrder(orderId);
            console.log(`   isPaid: ${order.isPaid}, paymentReleased: ${order.paymentReleased}`);
            expect(order.isPaid).to.be.false;

            console.log("\n2. Client pays order (isPaid: true, paymentReleased: false)");
            await gigMarketplace.connect(client).payOrder(orderId, { value: gigPrice });
            order = await gigMarketplace.getOrder(orderId);
            console.log(`   isPaid: ${order.isPaid}, paymentReleased: ${order.paymentReleased}`);
            expect(order.isPaid).to.be.true;
            expect(order.paymentReleased).to.be.false;

            console.log("\n3. Provider completes work");
            await gigMarketplace.connect(provider).completeOrder(orderId);
            order = await gigMarketplace.getOrder(orderId);
            console.log(`   isCompleted: ${order.isCompleted}`);
            expect(order.isCompleted).to.be.true;

            console.log("\n4. Client releases payment (paymentReleased: true)");
            await gigMarketplace.connect(client).releasePayment(orderId);
            order = await gigMarketplace.getOrder(orderId);
            console.log(`   isPaid: ${order.isPaid}, paymentReleased: ${order.paymentReleased}`);
            expect(order.paymentReleased).to.be.true;

            console.log("\n✓ COMPLETE LIFECYCLE: pending → paid → completed → released");
        });

        it("Should fail payment attempts with incorrect amount", async function () {
            console.log("\n=== TESTING PAYMENT VALIDATION ===");
            
            // Setup
            await gigMarketplace.connect(provider).createGig(
                "Validation Test",
                "Testing payment validation",
                gigPrice,
                ethers.ZeroAddress
            );
            
            await gigMarketplace.connect(client).orderGig(1);
            orderId = 1;

            console.log("✓ Order created, attempting payment with incorrect amount...");
            
            // Should fail with incorrect payment amount
            await expect(
                gigMarketplace.connect(client).payOrder(orderId, {
                    value: ethers.parseEther("0.5") // Wrong amount
                })
            ).to.be.revertedWith("Incorrect payment amount");

            console.log("✓ Correctly rejected incorrect payment amount");

            // Should succeed with correct amount
            await gigMarketplace.connect(client).payOrder(orderId, {
                value: gigPrice // Correct amount
            });

            const order = await gigMarketplace.getOrder(orderId);
            expect(order.isPaid).to.be.true;
            console.log("✓ Payment accepted with correct amount");
        });
    });

    describe("Multiple Orders Payment Status", function () {
        it("Should handle payment status for multiple orders independently", async function () {
            console.log("\n=== TESTING MULTIPLE ORDERS ===");
            
            // Create one gig
            await gigMarketplace.connect(provider).createGig(
                "Multi Order Test",
                "Testing multiple orders",
                gigPrice,
                ethers.ZeroAddress
            );

            // Create multiple orders from the same client
            await gigMarketplace.connect(client).orderGig(1);
            await gigMarketplace.connect(client).orderGig(1);
            
            console.log("✓ Created 2 orders for the same gig");

            // Check both orders are initially unpaid
            let order1 = await gigMarketplace.getOrder(1);
            let order2 = await gigMarketplace.getOrder(2);
            
            expect(order1.isPaid).to.be.false;
            expect(order2.isPaid).to.be.false;
            console.log("✓ Both orders start as unpaid");

            // Pay for first order only
            await gigMarketplace.connect(client).payOrder(1, { value: gigPrice });
            
            order1 = await gigMarketplace.getOrder(1);
            order2 = await gigMarketplace.getOrder(2);
            
            expect(order1.isPaid).to.be.true;
            expect(order2.isPaid).to.be.false;
            console.log("✓ Order 1 paid, Order 2 still pending");

            // Pay for second order
            await gigMarketplace.connect(client).payOrder(2, { value: gigPrice });
            
            order2 = await gigMarketplace.getOrder(2);
            expect(order2.isPaid).to.be.true;
            console.log("✓ Order 2 now also paid");

            console.log("✓ Multiple orders handled independently");
        });
    });
});
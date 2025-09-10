const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");

describe("GigMarketplace Complete Flow", function () {
    let gigMarketplace;
    let owner, provider, client, otherClient;
    let gigId, orderId;
    const gigPrice = ethers.parseEther("1.0");
    const platformFeePercent = 5;

    beforeEach(async function () {
        [owner, provider, client, otherClient] = await ethers.getSigners();

        const GigMarketplace = await ethers.getContractFactory("GigMarketplace");
        gigMarketplace = await upgrades.deployProxy(GigMarketplace, [], { initializer: 'initialize' });
        await gigMarketplace.waitForDeployment();
    });

    describe("Complete Gig Flow", function () {
        it("Should complete the full flow: create gig -> order -> pay -> complete -> release payment", async function () {
            // Step 1: Provider creates a gig
            const createTx = await gigMarketplace.connect(provider).createGig(
                "Web Development",
                "I will create a responsive website",
                gigPrice,
                ethers.ZeroAddress // Using ETH
            );
            await createTx.wait();
            
            gigId = 1;
            const gig = await gigMarketplace.getGig(gigId);
            expect(gig.title).to.equal("Web Development");
            expect(gig.price).to.equal(gigPrice);
            expect(gig.isActive).to.be.true;

            // Step 2: Client orders the gig
            const orderTx = await gigMarketplace.connect(client).orderGig(gigId, {
                value: gigPrice
            });
            await orderTx.wait();

            orderId = 1;
            const order = await gigMarketplace.getOrder(orderId);
            expect(order.client).to.equal(client.address);
            expect(order.provider).to.equal(provider.address);
            expect(order.amount).to.equal(gigPrice);
            expect(order.isCompleted).to.be.false;
            expect(order.isPaid).to.be.false;

            // Step 3: Provider completes the work
            const completeTx = await gigMarketplace.connect(provider).completeOrder(orderId);
            await completeTx.wait();

            const completedOrder = await gigMarketplace.getOrder(orderId);
            expect(completedOrder.isCompleted).to.be.true;

            // Step 4: Client releases payment
            const providerBalanceBefore = await ethers.provider.getBalance(provider.address);
            const ownerBalanceBefore = await ethers.provider.getBalance(owner.address);

            const releaseTx = await gigMarketplace.connect(client).releasePayment(orderId);
            await releaseTx.wait();

            const paidOrder = await gigMarketplace.getOrder(orderId);
            expect(paidOrder.isPaid).to.be.true;

            // Verify payment distribution
            const providerBalanceAfter = await ethers.provider.getBalance(provider.address);
            const ownerBalanceAfter = await ethers.provider.getBalance(owner.address);

            const expectedProviderAmount = gigPrice * 95n / 100n; // 95% after 5% fee
            const expectedPlatformFee = gigPrice * 5n / 100n; // 5% platform fee

            expect(providerBalanceAfter - providerBalanceBefore).to.equal(expectedProviderAmount);
            expect(ownerBalanceAfter - ownerBalanceBefore).to.equal(expectedPlatformFee);
        });
    });

    describe("Order Gig Tests", function () {
        beforeEach(async function () {
            // Create a gig for testing orders
            await gigMarketplace.connect(provider).createGig(
                "Graphic Design",
                "I will design your logo",
                gigPrice,
                ethers.ZeroAddress
            );
            gigId = 1;
        });

        it("Should allow client to order an active gig", async function () {
            const tx = await gigMarketplace.connect(client).orderGig(gigId, {
                value: gigPrice
            });
            await tx.wait();

            const order = await gigMarketplace.getOrder(1);
            expect(order.gigId).to.equal(gigId);
            expect(order.client).to.equal(client.address);
            expect(order.amount).to.equal(gigPrice);
        });

        it("Should fail if payment amount is incorrect", async function () {
            await expect(
                gigMarketplace.connect(client).orderGig(gigId, {
                    value: ethers.parseEther("0.5")
                })
            ).to.be.revertedWith("Incorrect payment amount");
        });

        it("Should prevent provider from ordering their own gig", async function () {
            await expect(
                gigMarketplace.connect(provider).orderGig(gigId, {
                    value: gigPrice
                })
            ).to.be.revertedWith("Cannot order your own gig");
        });

        it("Should fail to order inactive gig", async function () {
            await gigMarketplace.connect(provider).deactivateGig(gigId);
            
            await expect(
                gigMarketplace.connect(client).orderGig(gigId, {
                    value: gigPrice
                })
            ).to.be.revertedWith("Gig is not active");
        });
    });

    describe("Payment Tests", function () {
        beforeEach(async function () {
            // Create gig and order for testing payments
            await gigMarketplace.connect(provider).createGig(
                "Content Writing",
                "I will write blog posts",
                gigPrice,
                ethers.ZeroAddress
            );
            gigId = 1;

            await gigMarketplace.connect(client).orderGig(gigId, {
                value: gigPrice
            });
            orderId = 1;
        });

        it("Should prevent payment release before completion", async function () {
            await expect(
                gigMarketplace.connect(client).releasePayment(orderId)
            ).to.be.revertedWith("Order is not completed");
        });

        it("Should allow payment release after completion", async function () {
            await gigMarketplace.connect(provider).completeOrder(orderId);
            
            const tx = await gigMarketplace.connect(client).releasePayment(orderId);
            await tx.wait();

            const order = await gigMarketplace.getOrder(orderId);
            expect(order.isPaid).to.be.true;
        });

        it("Should prevent double payment", async function () {
            await gigMarketplace.connect(provider).completeOrder(orderId);
            await gigMarketplace.connect(client).releasePayment(orderId);

            await expect(
                gigMarketplace.connect(client).releasePayment(orderId)
            ).to.be.revertedWith("Payment already released");
        });

        it("Should only allow client to release payment", async function () {
            await gigMarketplace.connect(provider).completeOrder(orderId);

            await expect(
                gigMarketplace.connect(otherClient).releasePayment(orderId)
            ).to.be.revertedWith("Only order client can call this function");
        });
    });

    describe("Order Completion Tests", function () {
        beforeEach(async function () {
            await gigMarketplace.connect(provider).createGig(
                "Video Editing",
                "I will edit your video",
                gigPrice,
                ethers.ZeroAddress
            );
            gigId = 1;

            await gigMarketplace.connect(client).orderGig(gigId, {
                value: gigPrice
            });
            orderId = 1;
        });

        it("Should allow provider to complete order", async function () {
            const tx = await gigMarketplace.connect(provider).completeOrder(orderId);
            await tx.wait();

            const order = await gigMarketplace.getOrder(orderId);
            expect(order.isCompleted).to.be.true;
        });

        it("Should prevent double completion", async function () {
            await gigMarketplace.connect(provider).completeOrder(orderId);

            await expect(
                gigMarketplace.connect(provider).completeOrder(orderId)
            ).to.be.revertedWith("Order is already completed");
        });

        it("Should only allow provider to complete order", async function () {
            await expect(
                gigMarketplace.connect(client).completeOrder(orderId)
            ).to.be.revertedWith("Only gig provider can call this function");
        });
    });

    describe("Multiple Orders Scenario", function () {
        it("Should handle multiple orders for the same gig", async function () {
            // Create a gig
            await gigMarketplace.connect(provider).createGig(
                "SEO Services",
                "I will optimize your website",
                gigPrice,
                ethers.ZeroAddress
            );
            gigId = 1;

            // Multiple clients order the same gig
            await gigMarketplace.connect(client).orderGig(gigId, { value: gigPrice });
            await gigMarketplace.connect(otherClient).orderGig(gigId, { value: gigPrice });

            // Check orders
            const order1 = await gigMarketplace.getOrder(1);
            const order2 = await gigMarketplace.getOrder(2);

            expect(order1.client).to.equal(client.address);
            expect(order2.client).to.equal(otherClient.address);
            expect(order1.gigId).to.equal(gigId);
            expect(order2.gigId).to.equal(gigId);

            // Complete and pay for both orders independently
            await gigMarketplace.connect(provider).completeOrder(1);
            await gigMarketplace.connect(provider).completeOrder(2);

            await gigMarketplace.connect(client).releasePayment(1);
            await gigMarketplace.connect(otherClient).releasePayment(2);

            const finalOrder1 = await gigMarketplace.getOrder(1);
            const finalOrder2 = await gigMarketplace.getOrder(2);

            expect(finalOrder1.isPaid).to.be.true;
            expect(finalOrder2.isPaid).to.be.true;
        });
    });

    describe("Edge Cases", function () {
        it("Should handle contract balance correctly after multiple transactions", async function () {
            // Create multiple gigs and orders
            for (let i = 0; i < 3; i++) {
                await gigMarketplace.connect(provider).createGig(
                    `Service ${i}`,
                    `Description ${i}`,
                    gigPrice,
                    ethers.ZeroAddress
                );
                
                await gigMarketplace.connect(client).orderGig(i + 1, { value: gigPrice });
                await gigMarketplace.connect(provider).completeOrder(i + 1);
                await gigMarketplace.connect(client).releasePayment(i + 1);
            }

            // Check that contract doesn't hold residual funds
            const contractBalance = await ethers.provider.getBalance(await gigMarketplace.getAddress());
            expect(contractBalance).to.equal(0);
        });

        it("Should revert on attempts to operate on non-existent orders", async function () {
            await expect(
                gigMarketplace.connect(provider).completeOrder(999)
            ).to.be.revertedWith("Only gig provider can call this function");

            await expect(
                gigMarketplace.connect(client).releasePayment(999)
            ).to.be.revertedWith("Only order client can call this function");
        });
    });
});
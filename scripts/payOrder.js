const { ethers } = require("hardhat");

async function main() {
  console.log("=== Order Payment Script ===\n");

  // Get the deployed contract
  const contractAddress = "0x47fe84b56840a20BF579300207EBBaBc615AE1e9";
  const GigMarketplace = await ethers.getContractFactory("GigMarketplace");
  const contract = GigMarketplace.attach(contractAddress);

  // Get the available signer (from PRIVATE_KEY in .env)
  const signers = await ethers.getSigners();
  if (signers.length === 0) {
    console.log("❌ No signers available. Make sure PRIVATE_KEY is set in .env file");
    return;
  }
  
  const signer = signers[0];
  
  console.log("Contract Address:", contractAddress);
  console.log("Available Signer Address:", signer.address);
  console.log();

  // Check if contract is paused
  const isPaused = await contract.paused();
  console.log("Contract Paused:", isPaused);
  if (isPaused) {
    console.log("⚠️  Contract is paused, cannot proceed with payment");
    return;
  }

  // Get order details first
  const orderId = 1; // Change this to the order you want to pay for
  
  try {
    const order = await contract.getOrder(orderId);
    console.log("Order Details:");
    console.log("- Order ID:", order.id.toString());
    console.log("- Gig ID:", order.gigId.toString());
    console.log("- Client:", order.client);
    console.log("- Provider:", order.provider);
    console.log("- Amount:", ethers.formatEther(order.amount), "HBAR");
    console.log("- Amount (wei):", order.amount.toString());
    console.log("- Is Completed:", order.isCompleted);
    console.log("- Is Paid:", order.isPaid);
    console.log("- Payment Released:", order.paymentReleased);
    console.log("- Created At:", new Date(Number(order.createdAt) * 1000).toISOString());
    console.log();

    if (order.isPaid) {
      console.log("❌ Order is already paid!");
      return;
    }

    // Get signer's balance
    const signerBalance = await ethers.provider.getBalance(signer.address);
    console.log("Signer Balance:", ethers.formatEther(signerBalance), "HBAR");
    
    // Check if this signer is the client for this order
    console.log("Order Client:", order.client);
    console.log("Current Signer:", signer.address);
    console.log("Signer is Client:", order.client.toLowerCase() === signer.address.toLowerCase());
    
    // Check if signer has enough balance
    if (signerBalance < order.amount) {
      console.log("❌ Signer doesn't have enough balance to pay for this order");
      return;
    }

    // Connect contract with signer
    const contractWithSigner = contract.connect(signer);

    console.log("\n=== Attempting Payment ===");
    console.log("Paying for Order ID:", orderId);
    console.log("Payment Amount:", ethers.formatEther(order.amount), "HBAR");
    console.log("Payment Amount (wei):", order.amount.toString());

    // Try manual function call encoding
    console.log("\n--- Manual Transaction Construction ---");
    
    // Encode the function call manually
    const contractInterface = new ethers.Interface([
      "function payOrder(uint256 _orderId) payable"
    ]);
    const functionData = contractInterface.encodeFunctionData("payOrder", [orderId]);
    
    console.log("Function Data:", functionData);
    console.log("Function Data Length:", functionData.length);
    
    // Create transaction request manually
    const txRequest = {
      to: contractAddress,
      data: functionData,
      value: order.amount,
      gasLimit: 300000
    };
    
    console.log("Transaction Request:", {
      to: txRequest.to,
      data: txRequest.data,
      value: txRequest.value.toString(),
      gasLimit: txRequest.gasLimit
    });

    // Send transaction manually
    const tx = await signer.sendTransaction(txRequest);

    console.log("Transaction Hash:", tx.hash);
    console.log("Waiting for confirmation...");

    const receipt = await tx.wait();
    console.log("Transaction confirmed in block:", receipt.blockNumber);
    console.log("Gas used:", receipt.gasUsed.toString());

    if (receipt.status === 1) {
      console.log("✅ Payment successful!");
      
      // Get updated order details
      const updatedOrder = await contract.getOrder(orderId);
      console.log("\nUpdated Order Status:");
      console.log("- Is Paid:", updatedOrder.isPaid);
      console.log("- Is Completed:", updatedOrder.isCompleted);
      console.log("- Payment Released:", updatedOrder.paymentReleased);

      // Check for OrderPaid event
      const orderPaidEvents = receipt.logs.filter(log => {
        try {
          const parsedLog = contract.interface.parseLog(log);
          return parsedLog && parsedLog.name === 'OrderPaid';
        } catch (e) {
          return false;
        }
      });

      if (orderPaidEvents.length > 0) {
        const event = contract.interface.parseLog(orderPaidEvents[0]);
        console.log("\n📧 OrderPaid Event Emitted:");
        console.log("- Order ID:", event.args[0].toString());
        console.log("- Client:", event.args[1]);
        console.log("- Amount:", ethers.formatEther(event.args[2]), "HBAR");
      }

    } else {
      console.log("❌ Payment failed - transaction reverted");
    }

  } catch (error) {
    console.error("❌ Error occurred:");
    
    if (error.reason) {
      console.error("Reason:", error.reason);
    }
    
    if (error.data && error.data.includes("Order does not exist")) {
      console.error("Order does not exist - check the order ID");
    } else if (error.data && error.data.includes("Order is already paid")) {
      console.error("Order is already paid");
    } else if (error.data && error.data.includes("Only order client can pay")) {
      console.error("Only the order client can pay for this order");
    } else if (error.data && error.data.includes("Incorrect payment amount")) {
      console.error("Incorrect payment amount - check the order amount");
    } else if (error.code === "INSUFFICIENT_FUNDS") {
      console.error("Insufficient funds to pay for the order");
    } else {
      console.error("Full error:", error);
    }
  }
}

// Handle script execution
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Script failed:", error);
    process.exit(1);
  });
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";

contract GigMarketplace is 
    Initializable, 
    OwnableUpgradeable, 
    ReentrancyGuardUpgradeable, 
    PausableUpgradeable 
{
    struct Gig {
        uint256 id;
        address payable provider;
        string title;
        string description;
        uint256 price;
        address token;
        bool isActive;
        bool isCompleted;
    }

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

    mapping(uint256 => Gig) public gigs;
    mapping(uint256 => Order) public orders;
    mapping(address => uint256[]) public providerGigs;
    mapping(address => uint256[]) public clientOrders;

    uint256 public nextGigId;
    uint256 public nextOrderId;
    uint256 public platformFeePercent;

    event GigCreated(uint256 indexed gigId, address indexed provider, string title, uint256 price);
    event GigUpdated(uint256 indexed gigId, string title, string description, uint256 price);
    event GigDeactivated(uint256 indexed gigId);
    event OrderCreated(uint256 indexed orderId, uint256 indexed gigId, address indexed client, uint256 amount);
    event OrderCompleted(uint256 indexed orderId);
    event PaymentReleased(uint256 indexed orderId, address indexed provider, uint256 amount);


    modifier onlyProvider(uint256 _gigId) {
        require(msg.sender == gigs[_gigId].provider, "Only gig provider can call this function");
        _;
    }

    modifier onlyClient(uint256 _orderId) {
        require(msg.sender == orders[_orderId].client, "Only order client can call this function");
        _;
    }

    function initialize() public initializer {
        __Ownable_init(msg.sender);
        __ReentrancyGuard_init();
        __Pausable_init();
        
        nextGigId = 1;
        nextOrderId = 1;
        platformFeePercent = 5; // 5% platform fee
    }

    function createGig(
        string memory _title,
        string memory _description,
        uint256 _price,
        address _token
    ) external whenNotPaused {
        require(bytes(_title).length > 0, "Title cannot be empty");
        require(_price > 0, "Price must be greater than 0");

        gigs[nextGigId] = Gig({
            id: nextGigId,
            provider: payable(msg.sender),
            title: _title,
            description: _description,
            price: _price,
            token: _token,
            isActive: true,
            isCompleted: false
        });

        providerGigs[msg.sender].push(nextGigId);
        
        emit GigCreated(nextGigId, msg.sender, _title, _price);
        nextGigId++;
    }

    function updateGig(
        uint256 _gigId,
        string memory _title,
        string memory _description,
        uint256 _price,
        address _token
    ) external onlyProvider(_gigId) {
        require(gigs[_gigId].isActive, "Gig is not active");
        require(bytes(_title).length > 0, "Title cannot be empty");
        require(_price > 0, "Price must be greater than 0");

        gigs[_gigId].title = _title;
        gigs[_gigId].description = _description;
        gigs[_gigId].price = _price;
        gigs[_gigId].token = _token;

        emit GigUpdated(_gigId, _title, _description, _price);
    }

    function deactivateGig(uint256 _gigId) external onlyProvider(_gigId) {
        require(gigs[_gigId].isActive, "Gig is already inactive");
        
        gigs[_gigId].isActive = false;
        emit GigDeactivated(_gigId);
    }

    function orderGig(uint256 _gigId) external payable whenNotPaused nonReentrant {
        require(gigs[_gigId].isActive, "Gig is not active");
        require(msg.value == gigs[_gigId].price, "Incorrect payment amount");
        require(msg.sender != gigs[_gigId].provider, "Cannot order your own gig");

        orders[nextOrderId] = Order({
            id: nextOrderId,
            gigId: _gigId,
            client: payable(msg.sender),
            provider: gigs[_gigId].provider,
            amount: msg.value,
            isCompleted: false,
            isPaid: false,
            createdAt: block.timestamp
        });

        clientOrders[msg.sender].push(nextOrderId);

        emit OrderCreated(nextOrderId, _gigId, msg.sender, msg.value);
        nextOrderId++;
    }

    function completeOrder(uint256 _orderId) external onlyProvider(_orderId) {
        require(!orders[_orderId].isCompleted, "Order is already completed");
        
        orders[_orderId].isCompleted = true;
        emit OrderCompleted(_orderId);
    }

    function releasePayment(uint256 _orderId) external onlyClient(_orderId) nonReentrant {
        require(orders[_orderId].isCompleted, "Order is not completed");
        require(!orders[_orderId].isPaid, "Payment already released");

        orders[_orderId].isPaid = true;

        uint256 platformFee = (orders[_orderId].amount * platformFeePercent) / 100;
        uint256 providerAmount = orders[_orderId].amount - platformFee;

        orders[_orderId].provider.transfer(providerAmount);
        payable(owner()).transfer(platformFee);

        emit PaymentReleased(_orderId, orders[_orderId].provider, providerAmount);
    }

    function getProviderGigs(address _provider) external view returns (uint256[] memory) {
        return providerGigs[_provider];
    }

    function getClientOrders(address _client) external view returns (uint256[] memory) {
        return clientOrders[_client];
    }

    function setPlatformFee(uint256 _feePercent) external onlyOwner {
        require(_feePercent <= 10, "Platform fee cannot exceed 10%");
        platformFeePercent = _feePercent;
    }

    function withdrawPlatformFees() external onlyOwner nonReentrant {
        uint256 balance = address(this).balance;
        require(balance > 0, "No funds to withdraw");
        payable(owner()).transfer(balance);
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    function getGig(uint256 _gigId) external view returns (Gig memory) {
        return gigs[_gigId];
    }

    function getOrder(uint256 _orderId) external view returns (Order memory) {
        return orders[_orderId];
    }

    function getAllActiveGigs() external view returns (Gig[] memory) {
        uint256 activeCount = 0;
        
        for (uint256 i = 1; i < nextGigId; i++) {
            if (gigs[i].isActive) {
                activeCount++;
            }
        }
        
        Gig[] memory activeGigs = new Gig[](activeCount);
        uint256 currentIndex = 0;
        
        for (uint256 i = 1; i < nextGigId; i++) {
            if (gigs[i].isActive) {
                activeGigs[currentIndex] = gigs[i];
                currentIndex++;
            }
        }
        
        return activeGigs;
    }

    function getAllProviders() external view returns (address[] memory) {
        uint256 providerCount = 0;
        address[] memory tempProviders = new address[](nextGigId - 1);
        
        for (uint256 i = 1; i < nextGigId; i++) {
            address provider = gigs[i].provider;
            bool exists = false;
            
            for (uint256 j = 0; j < providerCount; j++) {
                if (tempProviders[j] == provider) {
                    exists = true;
                    break;
                }
            }
            
            if (!exists) {
                tempProviders[providerCount] = provider;
                providerCount++;
            }
        }
        
        address[] memory providers = new address[](providerCount);
        for (uint256 i = 0; i < providerCount; i++) {
            providers[i] = tempProviders[i];
        }
        
        return providers;
    }
}
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";

contract Bookings is 
    Initializable, 
    OwnableUpgradeable, 
    ReentrancyGuardUpgradeable, 
    PausableUpgradeable 
{
    enum PropertyType { HOTEL, RESTAURANT, EVENT_VENUE, APARTMENT }
    enum BookingStatus { PENDING, CONFIRMED, CANCELLED, COMPLETED }
    enum ServiceType { HOTEL, RESTAURANT, EVENT_VENUE, APARTMENT }

    struct Property {
        string id;
        string name;
        string description;
        string propertyAddress;
        PropertyType propertyType;
        uint256 pricePerNight;
        uint256 maxGuests;
        string[] amenities;
        bool isActive;
        address owner;
        uint256 createdAt;
    }

    struct Booking {
        string id;
        string propertyId;
        string customerName;
        string email;
        ServiceType serviceType;
        string startDate;
        string endDate;
        uint256 partySize;
        string specialRequests;
        BookingStatus status;
        uint256 totalAmount;
        bool isPaid;
        address customer;
        uint256 createdAt;
    }

    mapping(string => Property) public properties;
    mapping(string => Booking) public bookings;
    mapping(address => string[]) public customerBookings;
    mapping(address => string[]) public ownerProperties;
    mapping(string => string[]) public propertyBookings;

    string[] public allPropertyIds;
    string[] public allBookingIds;
    uint256 public platformFeePercent;

    event PropertyRegistered(string indexed propertyId, address indexed owner, string name, PropertyType propertyType);
    event PropertyUpdated(string indexed propertyId, string name, PropertyType propertyType);
    event PropertyDeactivated(string indexed propertyId);
    event BookingCreated(string indexed bookingId, string indexed propertyId, address indexed customer, uint256 totalAmount);
    event BookingConfirmed(string indexed bookingId);
    event BookingCancelled(string indexed bookingId);
    event BookingCompleted(string indexed bookingId);
    event PaymentProcessed(string indexed bookingId, address indexed customer, uint256 amount);

    modifier onlyPropertyOwner(string memory _propertyId) {
        require(properties[_propertyId].owner == msg.sender, "Only property owner can call this function");
        _;
    }

    modifier onlyBookingCustomer(string memory _bookingId) {
        require(bookings[_bookingId].customer == msg.sender, "Only booking customer can call this function");
        _;
    }

    modifier validProperty(string memory _propertyId) {
        require(bytes(properties[_propertyId].id).length > 0, "Property does not exist");
        require(properties[_propertyId].isActive, "Property is not active");
        _;
    }

    modifier validBooking(string memory _bookingId) {
        require(bytes(bookings[_bookingId].id).length > 0, "Booking does not exist");
        _;
    }

    function initialize() public initializer {
        __Ownable_init(msg.sender);
        __ReentrancyGuard_init();
        __Pausable_init();
        
        platformFeePercent = 5; // 5% platform fee
    }

    function registerProperty(
        string memory _propertyId,
        string memory _name,
        string memory _description,
        string memory _propertyAddress,
        PropertyType _propertyType,
        uint256 _pricePerNight,
        uint256 _maxGuests,
        string[] memory _amenities
    ) external whenNotPaused {
        require(bytes(_propertyId).length > 0, "Property ID cannot be empty");
        require(bytes(_name).length > 0, "Property name cannot be empty");
        require(bytes(properties[_propertyId].id).length == 0, "Property already exists");
        require(_maxGuests > 0, "Max guests must be greater than 0");

        properties[_propertyId] = Property({
            id: _propertyId,
            name: _name,
            description: _description,
            propertyAddress: _propertyAddress,
            propertyType: _propertyType,
            pricePerNight: _pricePerNight,
            maxGuests: _maxGuests,
            amenities: _amenities,
            isActive: true,
            owner: msg.sender,
            createdAt: block.timestamp
        });

        ownerProperties[msg.sender].push(_propertyId);
        allPropertyIds.push(_propertyId);
        
        emit PropertyRegistered(_propertyId, msg.sender, _name, _propertyType);
    }

    function updateProperty(
        string memory _propertyId,
        string memory _name,
        string memory _description,
        string memory _propertyAddress,
        PropertyType _propertyType,
        uint256 _pricePerNight,
        uint256 _maxGuests,
        string[] memory _amenities
    ) external onlyPropertyOwner(_propertyId) {
        require(bytes(_name).length > 0, "Property name cannot be empty");
        require(_maxGuests > 0, "Max guests must be greater than 0");

        Property storage property = properties[_propertyId];
        property.name = _name;
        property.description = _description;
        property.propertyAddress = _propertyAddress;
        property.propertyType = _propertyType;
        property.pricePerNight = _pricePerNight;
        property.maxGuests = _maxGuests;
        property.amenities = _amenities;

        emit PropertyUpdated(_propertyId, _name, _propertyType);
    }

    function deactivateProperty(string memory _propertyId) external onlyPropertyOwner(_propertyId) {
        require(properties[_propertyId].isActive, "Property is already inactive");
        
        properties[_propertyId].isActive = false;
        emit PropertyDeactivated(_propertyId);
    }

    function activateProperty(string memory _propertyId) external onlyPropertyOwner(_propertyId) {
        require(!properties[_propertyId].isActive, "Property is already active");
        
        properties[_propertyId].isActive = true;
    }

    function createBooking(
        string memory _bookingId,
        string memory _propertyId,
        string memory _customerName,
        string memory _email,
        ServiceType _serviceType,
        string memory _startDate,
        string memory _endDate,
        uint256 _partySize,
        string memory _specialRequests
    ) external payable whenNotPaused nonReentrant validProperty(_propertyId) {
        require(bytes(_bookingId).length > 0, "Booking ID cannot be empty");
        require(bytes(bookings[_bookingId].id).length == 0, "Booking already exists");
        require(bytes(_customerName).length > 0, "Customer name cannot be empty");
        require(bytes(_email).length > 0, "Email cannot be empty");
        require(_partySize > 0 && _partySize <= properties[_propertyId].maxGuests, "Invalid party size");
        require(msg.value > 0, "Payment amount must be greater than 0");

        bookings[_bookingId] = Booking({
            id: _bookingId,
            propertyId: _propertyId,
            customerName: _customerName,
            email: _email,
            serviceType: _serviceType,
            startDate: _startDate,
            endDate: _endDate,
            partySize: _partySize,
            specialRequests: _specialRequests,
            status: BookingStatus.PENDING,
            totalAmount: msg.value,
            isPaid: true,
            customer: msg.sender,
            createdAt: block.timestamp
        });

        customerBookings[msg.sender].push(_bookingId);
        propertyBookings[_propertyId].push(_bookingId);
        allBookingIds.push(_bookingId);

        emit BookingCreated(_bookingId, _propertyId, msg.sender, msg.value);
        emit PaymentProcessed(_bookingId, msg.sender, msg.value);
    }

    function confirmBooking(string memory _bookingId) external validBooking(_bookingId) {
        Booking storage booking = bookings[_bookingId];
        require(properties[booking.propertyId].owner == msg.sender, "Only property owner can confirm");
        require(booking.status == BookingStatus.PENDING, "Booking is not in pending status");

        booking.status = BookingStatus.CONFIRMED;
        emit BookingConfirmed(_bookingId);
    }

    function cancelBooking(string memory _bookingId) external validBooking(_bookingId) {
        Booking storage booking = bookings[_bookingId];
        require(
            booking.customer == msg.sender || properties[booking.propertyId].owner == msg.sender,
            "Only customer or property owner can cancel"
        );
        require(
            booking.status == BookingStatus.PENDING || booking.status == BookingStatus.CONFIRMED,
            "Booking cannot be cancelled"
        );

        booking.status = BookingStatus.CANCELLED;
        
        if (booking.isPaid && booking.totalAmount > 0) {
            payable(booking.customer).transfer(booking.totalAmount);
        }

        emit BookingCancelled(_bookingId);
    }

    function completeBooking(string memory _bookingId) external validBooking(_bookingId) nonReentrant {
        Booking storage booking = bookings[_bookingId];
        require(properties[booking.propertyId].owner == msg.sender, "Only property owner can complete");
        require(booking.status == BookingStatus.CONFIRMED, "Booking must be confirmed");
        require(booking.isPaid, "Booking must be paid");

        booking.status = BookingStatus.COMPLETED;

        uint256 platformFee = (booking.totalAmount * platformFeePercent) / 100;
        uint256 ownerAmount = booking.totalAmount - platformFee;

        payable(properties[booking.propertyId].owner).transfer(ownerAmount);
        if (platformFee > 0) {
            payable(owner()).transfer(platformFee);
        }

        emit BookingCompleted(_bookingId);
    }

    function getProperty(string memory _propertyId) external view returns (Property memory) {
        return properties[_propertyId];
    }

    function getBooking(string memory _bookingId) external view returns (Booking memory) {
        return bookings[_bookingId];
    }

    function getCustomerBookings(address _customer) external view returns (string[] memory) {
        return customerBookings[_customer];
    }

    function getOwnerProperties(address _owner) external view returns (string[] memory) {
        return ownerProperties[_owner];
    }

    function getPropertyBookings(string memory _propertyId) external view returns (string[] memory) {
        return propertyBookings[_propertyId];
    }

    function getAllActiveProperties() external view returns (Property[] memory) {
        uint256 activeCount = 0;
        
        for (uint256 i = 0; i < allPropertyIds.length; i++) {
            if (properties[allPropertyIds[i]].isActive) {
                activeCount++;
            }
        }
        
        Property[] memory activeProperties = new Property[](activeCount);
        uint256 currentIndex = 0;
        
        for (uint256 i = 0; i < allPropertyIds.length; i++) {
            if (properties[allPropertyIds[i]].isActive) {
                activeProperties[currentIndex] = properties[allPropertyIds[i]];
                currentIndex++;
            }
        }
        
        return activeProperties;
    }

    function getAllBookings() external view returns (Booking[] memory) {
        Booking[] memory allBookings = new Booking[](allBookingIds.length);
        
        for (uint256 i = 0; i < allBookingIds.length; i++) {
            allBookings[i] = bookings[allBookingIds[i]];
        }
        
        return allBookings;
    }

    function getBookingsByStatus(BookingStatus _status) external view returns (Booking[] memory) {
        uint256 count = 0;
        
        for (uint256 i = 0; i < allBookingIds.length; i++) {
            if (bookings[allBookingIds[i]].status == _status) {
                count++;
            }
        }
        
        Booking[] memory filteredBookings = new Booking[](count);
        uint256 currentIndex = 0;
        
        for (uint256 i = 0; i < allBookingIds.length; i++) {
            if (bookings[allBookingIds[i]].status == _status) {
                filteredBookings[currentIndex] = bookings[allBookingIds[i]];
                currentIndex++;
            }
        }
        
        return filteredBookings;
    }

    function setPlatformFee(uint256 _feePercent) external onlyOwner {
        require(_feePercent <= 15, "Platform fee cannot exceed 15%");
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

    function getContractStats() external view returns (
        uint256 totalProperties,
        uint256 activeProperties,
        uint256 totalBookings,
        uint256 pendingBookings,
        uint256 confirmedBookings,
        uint256 completedBookings
    ) {
        totalProperties = allPropertyIds.length;
        totalBookings = allBookingIds.length;
        
        for (uint256 i = 0; i < allPropertyIds.length; i++) {
            if (properties[allPropertyIds[i]].isActive) {
                activeProperties++;
            }
        }
        
        for (uint256 i = 0; i < allBookingIds.length; i++) {
            BookingStatus status = bookings[allBookingIds[i]].status;
            if (status == BookingStatus.PENDING) pendingBookings++;
            else if (status == BookingStatus.CONFIRMED) confirmedBookings++;
            else if (status == BookingStatus.COMPLETED) completedBookings++;
        }
    }
}
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title GiggleGiftCoupon
 * @dev Smart contract for creating and redeeming gift coupons on Giggle Pay
 *
 * Features:
 * - Create gift coupons with PYUSD
 * - Store metadata on IPFS (via Pinata)
 * - Redeem coupons with unique codes
 * - Expiration dates
 * - Creator messages
 * - On-chain verification
 */
contract GiggleGiftCoupon is Ownable, ReentrancyGuard {

    // Coupon structure
    struct Coupon {
        bytes32 codeHash;        // Keccak256 hash of the coupon code
        address creator;         // Who created the coupon
        address token;           // ERC20 token address (PYUSD)
        uint256 amount;          // Amount in token
        string metadataURI;      // IPFS URI for metadata (message, image, etc.)
        uint256 expiresAt;       // Expiration timestamp (0 = no expiration)
        bool redeemed;           // Redemption status
        address redeemedBy;      // Who redeemed it
        uint256 redeemedAt;      // When it was redeemed
        uint256 createdAt;       // Creation timestamp
    }

    // Mapping from coupon ID to Coupon
    mapping(uint256 => Coupon) public coupons;

    // Mapping from code hash to coupon ID (for quick lookup)
    mapping(bytes32 => uint256) public codeHashToCouponId;

    // Counter for coupon IDs
    uint256 public nextCouponId = 1;

    // Supported tokens
    mapping(address => bool) public supportedTokens;

    // Events
    event CouponCreated(
        uint256 indexed couponId,
        address indexed creator,
        address token,
        uint256 amount,
        string metadataURI,
        uint256 expiresAt
    );

    event CouponRedeemed(
        uint256 indexed couponId,
        address indexed redeemer,
        uint256 amount,
        uint256 redeemedAt
    );

    event CouponCancelled(
        uint256 indexed couponId,
        address indexed creator
    );

    event TokenAdded(address indexed token);
    event TokenRemoved(address indexed token);

    constructor() Ownable(msg.sender) {
        // msg.sender will be the initial owner
    }

    /**
     * @dev Add a supported token
     */
    function addSupportedToken(address token) external onlyOwner {
        require(token != address(0), "Invalid token address");
        supportedTokens[token] = true;
        emit TokenAdded(token);
    }

    /**
     * @dev Remove a supported token
     */
    function removeSupportedToken(address token) external onlyOwner {
        supportedTokens[token] = false;
        emit TokenRemoved(token);
    }

    /**
     * @dev Create a new gift coupon
     * @param code The unique coupon code (will be hashed)
     * @param token The ERC20 token address
     * @param amount The amount of tokens
     * @param metadataURI IPFS URI for metadata
     * @param expiresAt Expiration timestamp (0 for no expiration)
     */
    function createCoupon(
        string calldata code,
        address token,
        uint256 amount,
        string calldata metadataURI,
        uint256 expiresAt
    ) external nonReentrant returns (uint256) {
        require(bytes(code).length >= 6, "Code too short");
        require(supportedTokens[token], "Token not supported");
        require(amount > 0, "Amount must be > 0");
        require(
            expiresAt == 0 || expiresAt > block.timestamp,
            "Invalid expiration"
        );

        // Hash the code for privacy
        bytes32 codeHash = keccak256(abi.encodePacked(code));
        require(codeHashToCouponId[codeHash] == 0, "Code already used");

        // Transfer tokens from creator to contract
        IERC20(token).transferFrom(msg.sender, address(this), amount);

        // Create coupon
        uint256 couponId = nextCouponId++;
        coupons[couponId] = Coupon({
            codeHash: codeHash,
            creator: msg.sender,
            token: token,
            amount: amount,
            metadataURI: metadataURI,
            expiresAt: expiresAt,
            redeemed: false,
            redeemedBy: address(0),
            redeemedAt: 0,
            createdAt: block.timestamp
        });

        codeHashToCouponId[codeHash] = couponId;

        emit CouponCreated(
            couponId,
            msg.sender,
            token,
            amount,
            metadataURI,
            expiresAt
        );

        return couponId;
    }

    /**
     * @dev Redeem a gift coupon
     * @param code The coupon code
     */
    function redeemCoupon(string calldata code) external nonReentrant {
        bytes32 codeHash = keccak256(abi.encodePacked(code));
        uint256 couponId = codeHashToCouponId[codeHash];

        require(couponId != 0, "Invalid code");

        Coupon storage coupon = coupons[couponId];

        require(!coupon.redeemed, "Already redeemed");
        require(coupon.creator != msg.sender, "Cannot redeem own coupon");
        require(
            coupon.expiresAt == 0 || block.timestamp <= coupon.expiresAt,
            "Coupon expired"
        );

        // Mark as redeemed
        coupon.redeemed = true;
        coupon.redeemedBy = msg.sender;
        coupon.redeemedAt = block.timestamp;

        // Transfer tokens to redeemer
        IERC20(coupon.token).transfer(msg.sender, coupon.amount);

        emit CouponRedeemed(
            couponId,
            msg.sender,
            coupon.amount,
            block.timestamp
        );
    }

    /**
     * @dev Cancel an unredeemed coupon and refund creator
     * @param couponId The ID of the coupon to cancel
     */
    function cancelCoupon(uint256 couponId) external nonReentrant {
        Coupon storage coupon = coupons[couponId];

        require(coupon.creator == msg.sender, "Not coupon creator");
        require(!coupon.redeemed, "Already redeemed");

        // Mark as redeemed to prevent future redemption
        coupon.redeemed = true;

        // Refund creator
        IERC20(coupon.token).transfer(msg.sender, coupon.amount);

        emit CouponCancelled(couponId, msg.sender);
    }

    /**
     * @dev Check if a code is valid and available
     * @param code The coupon code to check
     */
    function checkCoupon(string calldata code) external view returns (
        bool exists,
        bool isValid,
        address token,
        uint256 amount,
        string memory metadataURI,
        uint256 expiresAt,
        address creator
    ) {
        bytes32 codeHash = keccak256(abi.encodePacked(code));
        uint256 couponId = codeHashToCouponId[codeHash];

        if (couponId == 0) {
            return (false, false, address(0), 0, "", 0, address(0));
        }

        Coupon storage coupon = coupons[couponId];

        bool valid = !coupon.redeemed &&
                     (coupon.expiresAt == 0 || block.timestamp <= coupon.expiresAt);

        return (
            true,
            valid,
            coupon.token,
            coupon.amount,
            coupon.metadataURI,
            coupon.expiresAt,
            coupon.creator
        );
    }

    /**
     * @dev Get coupon details by ID
     */
    function getCoupon(uint256 couponId) external view returns (Coupon memory) {
        return coupons[couponId];
    }

    /**
     * @dev Get total number of coupons created
     */
    function getTotalCoupons() external view returns (uint256) {
        return nextCouponId - 1;
    }
}

// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity >=0.8.2 <0.9.0;

import {IERC20} from "@openzeppelin/contracts/interfaces/IERC20.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

contract Mixtral8x7BModelMarket {
    address private _proofOfStakeContract;

    error Unauthorized(address account);

    modifier onlyProofOfStake() {
        if (msg.sender != _proofOfStakeContract) {
            revert Unauthorized(msg.sender);
        }
        _;
    }

    IERC20 paymentToken;

    constructor(address proofOfStakeContract, address paymentTokenAddress) {
        _proofOfStakeContract = proofOfStakeContract;
        paymentToken = IERC20(paymentTokenAddress);
    }

    struct Hoster {
        string url;
        address hostAccount;
        uint256 price;
    }

    Hoster[] public allHosts;
    mapping(address host => bool) public paused;

    /** Data storage for paying on request */
    mapping(address host => mapping(string uuid => uint256 fees)) public paidRequestFees;
    /** ------------------------ */

    /** Data storage for prepaid requests */
    mapping(address client => uint256) public balances;
    mapping(address client => uint) public withdrawableAt;
    uint public withdrawHoldTime = 3600;
    mapping(string uuid => bool) public processedUuid;
    /** ------------------------ */

    function addHost(
        string memory url,
        address account,
        uint256 price
    ) external onlyProofOfStake returns (bool) {
        allHosts.push(Hoster(url, account, price));
        return true;
    }

    function removeHost(
        address account
    ) external onlyProofOfStake returns (bool) {
        for (uint256 i = 0; i < allHosts.length; i++) {
            if (allHosts[i].hostAccount == account) {
                delete allHosts[i];
                for (uint u = i; u < allHosts.length - 1; u++) {
                    allHosts[u] = allHosts[u + 1];
                }
                allHosts.pop();
                return true;
            }
        }
        return false;
    }

    function changePrice(uint256 price) external returns (bool) {
        for (uint256 i = 0; i < allHosts.length; i++) {
            if (allHosts[i].hostAccount == msg.sender) {
                allHosts[i].price = price;
                return true;
            }
        }
        return false;
    }

    function pause() external returns (bool) {
        paused[msg.sender] = true;
        return true;
    }

    function unpause() external returns (bool) {
        paused[msg.sender] = false;
        return true;
    }

    function pauseFromProofOfStake(
        address node
    ) external onlyProofOfStake returns (bool) {
        paused[node] = true;
        return true;
    }

    function getHosts() external view returns (Hoster[] memory) {
        return allHosts;
    }

    function getActiveHosts() external view returns (Hoster[] memory) {
        uint nrofActiveHosts = 0;
        for (uint i = 0; i < allHosts.length; i++) {
            if (!paused[allHosts[i].hostAccount]) {
                nrofActiveHosts += 1;
            }
        }
        Hoster[] memory activeHosts = new Hoster[](nrofActiveHosts);
        uint activeHostIdx = 0;
        for (uint i = 0; i < allHosts.length; i++) {
            if (!paused[allHosts[i].hostAccount]) {
                activeHosts[activeHostIdx] = allHosts[i];
                activeHostIdx += 1;
            }
        }
        return activeHosts;
    }

    function getHost(address node) external view returns (Hoster memory) {
        for (uint256 i = 0; i < allHosts.length; i++) {
            if (allHosts[i].hostAccount == node) {
                return allHosts[i];
            }
        }
        revert("Host not found");
    }

    function addRequest(
        string memory uuid,
        address host,
        uint256 value
    ) external returns (bool) {
        require(paused[host] == false, "Currently paused!");
        require(value >= 100, "Below minimum payment!");
        require(
            paymentToken.allowance(msg.sender, address(this)) >= value,
            "Not enough allowance!"
        );
        require(paidRequestFees[host][uuid] == 0, "UUID has been already used");
        paymentToken.transferFrom(msg.sender, host, value);
        paidRequestFees[host][uuid] = value;
        return true;
    }

    function getPaidRequestFees(
        address host,
        string memory uuid
    ) external view returns (uint256) {
        return paidRequestFees[host][uuid];
    }

    function getPaused(address host) external view returns (bool) {
        return paused[host];
    }

    struct Paymment {
        address sender;
        address receiver;
        uint256 amount;
        string uuid;
    }

    function getMessageHash(
        Paymment memory payment
    ) public pure returns (bytes32) {
        return
            keccak256(
                abi.encodePacked(
                    payment.sender,
                    payment.receiver,
                    payment.amount,
                    payment.uuid
                )
            );
    }

    function _isPaymentValid(
        Paymment memory payment,
        bytes memory signature
    ) private pure returns (bool) {
        bytes32 messageHash = getMessageHash(payment);
        bytes32 ethSignedMessageHash = MessageHashUtils.toEthSignedMessageHash(
            messageHash
        );

        address signer = ECDSA.recover(ethSignedMessageHash, signature);
        return signer == payment.sender;
    }

    function verifyPayment(
        Paymment memory payment,
        bytes memory signature
    ) public pure returns (bool) {
        require(_isPaymentValid(payment, signature), "Invalid signature");
        return true;
    }

    function deposit(uint256 amount) external returns (bool) {
        require(
            paymentToken.allowance(msg.sender, address(this)) >= amount,
            "Not enough allowance!"
        );
        paymentToken.transferFrom(msg.sender, address(this), amount);
        balances[msg.sender] += amount;
        return true;
    }

    function setWithdrawHoldTime(
        uint secs
    ) external onlyProofOfStake returns (uint) {
        withdrawHoldTime = secs;
        return withdrawHoldTime;
    }

    function requestWithdraw() external returns (uint) {
        require(
            withdrawableAt[msg.sender] == 0,
            "Withdraw request already maded"
        );
        withdrawableAt[msg.sender] = block.timestamp + withdrawHoldTime;
        return withdrawableAt[msg.sender];
    }

    function isPaymentAvailable(
        address sender,
        uint256 amount,
        string memory paymentUuid
    ) external view returns (bool) {
        // Not withdrawing and uuid is not proceesed
        return
            withdrawableAt[sender] == 0 &&
            !processedUuid[paymentUuid] &&
            balances[sender] >= amount;
    }

    function withdraw() external returns (uint256) {
        uint256 withdrawAmount = balances[msg.sender];
        require(
            withdrawableAt[msg.sender] != 0 &&
                block.timestamp >= withdrawableAt[msg.sender] &&
                withdrawAmount > 0,
            "Withdraw is not available now"
        );
        paymentToken.transfer(msg.sender, withdrawAmount);
        withdrawableAt[msg.sender] = 0;
        balances[msg.sender] = 0;
        return withdrawAmount;
    }

    function _claimFund(
        Paymment memory payment,
        uint256 actualAmount,
        bytes memory signature,
        bool skipIfInvalid
    ) private {
        if (skipIfInvalid) {
            if (processedUuid[payment.uuid]) return;
            if (balances[payment.sender] < payment.amount) return;
            if (actualAmount > payment.amount) return;
            if (!_isPaymentValid(payment, signature)) return;
        } else {
            require(!processedUuid[payment.uuid], "Payment already processed");
            require(
                balances[payment.sender] >= payment.amount,
                "Not enough balance"
            );
            require(
                actualAmount <= payment.amount,
                "Actual amount can not be greater than max amount"
            );
            require(
                _isPaymentValid(payment, signature),
                "Invalid payment request"
            );
        }

        paymentToken.transfer(payment.receiver, actualAmount);
        balances[payment.sender] -= actualAmount;
        processedUuid[payment.uuid] = true;
    }

    function claimFund(
        Paymment memory payment,
        uint256 actualAmount,
        bytes memory signature
    ) public {
        _claimFund(payment, actualAmount, signature, false);
    }

    function claimFunds(
        Paymment[] memory payments,
        uint256[] memory actualAmounts,
        bytes[] memory signatures
    ) external {
        require(
            payments.length == actualAmounts.length &&
                actualAmounts.length == signatures.length
        );
        for (uint i = 0; i < payments.length; i++) {
            _claimFund(payments[i], actualAmounts[i], signatures[i], true);
        }
    }
}

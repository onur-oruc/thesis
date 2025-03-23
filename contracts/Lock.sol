// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;
import "@gnosis.pm/safe-contracts/contracts/GnosisSafe.sol";
// Uncomment this line to use console.log
// import "hardhat/console.sol";

contract Lock {
    uint public unlockTime;
    address payable public owner;

    struct BatteryPublicMetadata {
        string arweave_tx_id; // Arweave transaction ID, pointer to the battery public metadata
        string data_hash; // Hash of the battery public metadata
        address signer; // Address of the signer
        uint256 timestamp; // Timestamp of the transaction
        string signature; // Signature of the signer
        uint256 predecessor_id; // Predecessor ID
    }

    struct PermissionNFT {
        uint256 tokenId;         // Unique NFT identifier
        string did;              // DID of the Permission Owner
        address issuer;          // OEM address
        address multisig;        // MultiSig wallet address
        uint256 expiry;          // Timestamp
        Permissions perms;       // { canSubmitData: true }
    }

    struct Permissions {
        bool canSubmitData;
        bool canReadData;
        bool canTransferOwnership;
        bool canIssuePermissions;
        bool canRevokePermissions;
    }
    event Withdrawal(uint amount, uint when);

    constructor(uint _unlockTime) payable {
        require(
            block.timestamp < _unlockTime,
            "Unlock time should be in the future"
        );

        unlockTime = _unlockTime;
        owner = payable(msg.sender);
    }

    function withdraw() public {
        // Uncomment this line, and the import of "hardhat/console.sol", to print a log in your terminal
        // console.log("Unlock time is %o and block timestamp is %o", unlockTime, block.timestamp);

        require(block.timestamp >= unlockTime, "You can't withdraw yet");
        require(msg.sender == owner, "You aren't the owner");

        emit Withdrawal(address(this).balance, block.timestamp);

        owner.transfer(address(this).balance);
    }
}

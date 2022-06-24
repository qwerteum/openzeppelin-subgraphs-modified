import { Address, BigDecimal, BigInt } from "@graphprotocol/graph-ts";
import { Blockchain, Collection, Owner, Token, Transaction } from "../../generated/schema";
import { Transfer } from "../../generated/erc721/EIP721";
import { EIP721 } from "../../generated/erc721/EIP721";


export const ZERO_BI = BigInt.zero();
export const ONE_BI = BigInt.fromI32(1);
export const TWO_BI = BigInt.fromI32(2);
export const THREE_BI = BigInt.fromI32(3);
export const FOUR_BI = BigInt.fromI32(4);
export const ZERO_BD = BigDecimal.zero();
export const ONE_BD = BigDecimal.fromString("1");
export const ZERO_ADDRESS = Address.fromString("0x0000000000000000000000000000000000000000");
export const ONE_ETHER_IN_WEI = BigInt.fromI32(10).pow(18);

export function handleTransfer(event: Transfer): void {
  let blockchain = Blockchain.load("ETH");
  if (blockchain === null) {
    // Blockchain
    blockchain = new Blockchain("ETH");
    blockchain.totalCollections = BigInt.zero();
    blockchain.totalTokens = BigInt.zero();
    blockchain.totalTransactions = BigInt.zero();
    blockchain.save();
  }
  blockchain.totalTransactions = blockchain.totalTransactions.plus(BigInt.fromI32(1));
  blockchain.save();

  let collection = Collection.load(event.address.toHex());
  if (collection === null) {
    // Collection
    collection = new Collection(event.address.toHex());
    collection.name = fetchName(event.address);
    collection.symbol = fetchSymbol(event.address);
	collection.totalOwners = BigInt.zero(); // totalOwners Introduction
    collection.totalTokens = BigInt.zero();
    collection.totalTransactions = BigInt.zero();
    collection.block = event.block.number;
    collection.createdAt = event.block.timestamp;
    collection.updatedAt = event.block.timestamp;
    collection.save();

    // Blockchain
    blockchain.totalCollections = blockchain.totalCollections.plus(BigInt.fromI32(1));
    blockchain.save();
  }
  collection.totalTransactions = collection.totalTransactions.plus(BigInt.fromI32(1));
  collection.updatedAt = event.block.timestamp;
  collection.save();

  let from = Owner.load(event.params.from.toHex());
  if (from === null) {
    // Owner - as Sender
    from = new Owner(event.params.from.toHex());
    from.totalTokens = BigInt.zero();
    from.totalTokensMinted = BigInt.zero();
    from.totalTransactions = BigInt.zero();
    from.block = event.block.number;
    from.createdAt = event.block.timestamp;
    from.updatedAt = event.block.timestamp;
    from.save();
  }

  if (event.params.from.equals(Address.zero())) {
  } else {
	if (from.totalTokens === BigInt.fromI32(1)) { // if sender has only one token before transaction
		collection.totalOwners.minus(BigInt.fromI32(1));
		collection.save()
	}
	from.totalTokens.minus(BigInt.fromI32(1));
  }

//   from.totalTokens = event.params.from.equals(Address.zero())
//     ? from.totalTokens
//     : from.totalTokens.minus(BigInt.fromI32(1));

//   if (from.totalTokens === BigInt.fromI32(0)) { // if sender has no token after transaction
// 	collection.totalOwners.minus(BigInt.fromI32(1));
// 	collection.save()
//   }

  from.totalTransactions = from.totalTransactions.plus(BigInt.fromI32(1));
  from.updatedAt = event.block.timestamp;
  from.save();

  let to = Owner.load(event.params.to.toHex());
  if (to === null) {
    // Owner - as Receiver
    to = new Owner(event.params.to.toHex());
    to.totalTokens = BigInt.zero();
    to.totalTokensMinted = BigInt.zero();
    to.totalTransactions = BigInt.zero();
    to.block = event.block.number;
    to.createdAt = event.block.timestamp;
    to.updatedAt = event.block.timestamp;
    to.save();
  }
  if (to.totalTokens === BigInt.fromI32(0)) { // if receiver doesn't have any token before transaction
	collection.totalOwners = collection.totalOwners.plus(BigInt.fromI32(1));
	collection.save()
  }
  to.totalTokens = to.totalTokens.plus(BigInt.fromI32(1));
  to.totalTransactions = to.totalTransactions.plus(BigInt.fromI32(1));
  to.updatedAt = event.block.timestamp;
  to.save();

  let token = Token.load(event.address.toHex() + "-" + event.params.tokenId.toString());
  if (token === null) {
    // Token
    token = new Token(event.address.toHex() + "-" + event.params.tokenId.toString());
    token.collection = collection.id;
    token.tokenID = event.params.tokenId;
    token.tokenURI = fetchTokenURI(event.address, event.params.tokenId);
    token.minter = to.id;
    token.owner = to.id;
    token.burned = false;
    token.totalTransactions = BigInt.zero();
    token.block = event.block.number;
    token.createdAt = event.block.timestamp;
    token.updatedAt = event.block.timestamp;
    token.save();
	
	// Uncounted Token Transfer
	collection.totalOwners = collection.totalOwners.plus(BigInt.fromI32(1));
	collection.save();

    // Owner - as Receiver
    to.totalTokensMinted = to.totalTokensMinted.plus(BigInt.fromI32(1));
    to.save();

    // Collection
    collection.totalTokens = collection.totalTokens.plus(BigInt.fromI32(1));
    collection.save();

    // Blockchain
    blockchain.totalTokens = blockchain.totalTokens.plus(BigInt.fromI32(1));
    blockchain.save();
  }
  token.owner = to.id;
  token.burned = event.params.to.equals(Address.zero());
  token.totalTransactions = token.totalTransactions.plus(BigInt.fromI32(1));
  token.updatedAt = event.block.timestamp;
  token.save();

  // Transaction
  const transaction = new Transaction(event.transaction.hash.toHex());
  transaction.hash = event.transaction.hash;
  transaction.from = from.id;
  transaction.to = to.id;
  transaction.collection = collection.id;
  transaction.token = token.id;
  transaction.gasLimit = event.transaction.gasLimit;
  transaction.gasPrice = toBigDecimal(event.transaction.gasPrice, 9);
  transaction.block = event.block.number;
  transaction.timestamp = event.block.timestamp;
  transaction.save();
}




// utils/eip721.ts
export function fetchName(address: Address): string {
  const contract = EIP721.bind(address);

  const nameResult = contract.try_name();
  if (!nameResult.reverted) {
    return nameResult.value;
  }

  return "unknown";
}

export function fetchSymbol(address: Address): string {
  const contract = EIP721.bind(address);

  const symbolResult = contract.try_symbol();
  if (!symbolResult.reverted) {
    return symbolResult.value;
  }

  return "unknown";
}

export function fetchTokenURI(address: Address, tokenID: BigInt): string | null {
  const contract = EIP721.bind(address);

  const uriResult = contract.try_tokenURI(tokenID);
  if (!uriResult.reverted) {
    return uriResult.value;
  }

  return null;
}

// helpers/utils.ts
/**
 * @param amount amount in BigInt
 * @param decimals number of decimal (optional)
 * @notice Parse the amount into a BigDecimal instance expressed in decimals
 */
 export function toBigDecimal(amount: BigInt, decimals: i32 = 18): BigDecimal {
	return amount.divDecimal(
	  BigInt.fromI32(10)
		.pow(decimals as u8)
		.toBigDecimal()
	);
  }
  
  /**
   * @param quantity amount in ETH (i32)
   * @param decimals number of decimal (optional)
   * @notice Parse the amount into a BigInt instance of the amount of wei.
   */
  export function parseEther(amount: i32, decimals: u8 = 18): BigInt {
	const adjuster = BigInt.fromI32(10).pow(decimals);
	return BigInt.fromI32(amount).times(adjuster);
  }
  
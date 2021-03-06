import * as React from 'react';
import { ActivityIndicator, Animated, Dimensions, FlatList, Image, PixelRatio, RefreshControl, Text, TextInput, TouchableOpacity, View } from 'react-native';
import BigNumber from 'bignumber.js';
import { Header } from 'react-navigation';
import { connect, createAction } from '../../../../utils/dva';
import { DismissKeyboardView } from '../../../components/DismissKeyboardView';
import { mainBgColor, mainColor } from '../../../style_util';
import commonStyles from '../../../styles';
import { Carousel } from '../../../components/carousel';
import { strings } from '../../../../locales/i18n';
import Loading from '../../../components/Loading';
import { SortButton } from '../../../components/common';
import { formatMoney, getStatusBarHeight } from '../../../../utils';
import { PopupMenu } from '../../../components/PopUpMenu';
import { POKKET_FAQ_URL, POKKET_MENU } from './constants';

const { width } = Dimensions.get('window');

class PokketHome extends React.Component {
    static navigationOptions = ({ navigation }) => {
        const openMenu = navigation.getParam('openMenu', () => {});
        return {
            title: strings('pokket.title'),
            headerRight: (
                <TouchableOpacity
                    style={{
                        width: 48,
                        height: 48,
                        alignItems: 'center',
                        justifyContent: 'center',
                    }}
                    onPress={openMenu}
                >
                    <Image source={require('../../../..//assets/icon_account_menu.png')} style={{ width: 25, height: 25, tintColor: '#fff' }} resizeMode="contain" />
                </TouchableOpacity>
            ),
        };
    };

    state = {
        keyword: '',
        isLoading: true,
        noNetwork: false,
        focusedSearch: false,
        listsDesc: true,
        showMenu: false,
        refreshing: false,
    };

    focusedAnimated = new Animated.Value(0);

    componentWillMount(): void {
        this.isMount = true;
        this.listenNavigation = this.props.navigation.addListener('willBlur', () => this.isMount && this.setState({ showMenu: false }));
        this.props.navigation.setParams({
            openMenu: this.openMenu,
        });
        setTimeout(() => {
            this.checkNetWork();
        }, 500);
    }

    componentWillUnmount(): void {
        this.isMount = false;
        this.listenNavigation.remove();
    }

    onRefresh = () => {
        if (this.state.refreshing) {
            return;
        }
        this.setState(
            {
                refreshing: true,
            },
            this.getProducts,
        );
    };

    openMenu = () => {
        this.setState({
            showMenu: true,
        });
    };

    onCloseMenu = select => {
        const { navigation } = this.props;
        this.setState(
            {
                showMenu: false,
            },
            () => {
                switch (select) {
                    case POKKET_MENU[0].title:
                        navigation.navigate('signed_pokket_order_list');
                        break;
                    case POKKET_MENU[1].title:
                        navigation.navigate('simple_webview', {
                            title: strings(POKKET_MENU[1].title),
                            initialUrl: { uri: POKKET_FAQ_URL },
                        });
                        break;
                    default:
                }
            },
        );
    };

    toggle = isActive => {
        this.setState({ focusedSearch: isActive });
        Animated.timing(this.focusedAnimated, {
            toValue: isActive ? 1 : 0,
            duration: 200,
        }).start();
    };

    searchProduct = keyword => {
        this.setState({
            keyword,
        });
    };

    getProducts = () => {
        const { dispatch } = this.props;
        dispatch(createAction('pokketModel/getProducts')({ keyword: '' })).then(len => {
            if (len > 0) {
                this.isMount &&
                    this.setState({
                        refreshing: false,
                    });
            }
        });
    };

    checkNetWork = () => {
        const { dispatch } = this.props;
        Promise.all([dispatch(createAction('pokketModel/getProducts')({ keyword: '' })), dispatch(createAction('pokketModel/getRemoteData')())])
            // eslint-disable-next-line no-unused-vars
            .then(([len, { error }]) => {
                if (error) {
                    this.isMount &&
                        this.setState({
                            isLoading: false,
                            noNetwork: true,
                        });
                } else {
                    this.isMount &&
                        this.setState({
                            isLoading: false,
                            noNetwork: false,
                        });
                }
            })
            .catch(() => {
                this.isMount &&
                    this.setState({
                        isLoading: false,
                        noNetwork: true,
                    });
            });
    };

    toProductDetail = ({ token, tokenFullName }) => {
        const { dispatch, navigation } = this.props;
        dispatch(createAction('pokketModel/setCurrentProduct')({ token }));
        navigation.navigate('signed_pokket_product', { title: `${token}/${tokenFullName}` });
    };

    renderLoading() {
        return (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                <ActivityIndicator animating color="red" size="large" />
            </View>
        );
    }

    renderBanners() {
        const { totalInvestment, banners } = this.props;
        const bannersViews = banners.reduce((arr, el, index) => {
            arr.push(
                <View style={styles.slide} key={`${index}`}>
                    <Image style={{ height: 120, width }} source={{ uri: el.imageUrl }} resizeMode="stretch" />
                </View>,
            );
            return arr;
        }, []);
        return (
            <Carousel delay={5000} style={{ width, height: 120 }} autoplay currentPage={0} bullets chosenBulletStyle={{ backgroundColor: mainColor }} bulletStyle={{ borderColor: mainColor }}>
                <View style={{ ...styles.slide, backgroundColor: 'white' }} key="totalInvestment">
                    <Text style={{ color: 'black', textAlign: 'center' }}>
                        {`${strings('pokket.label_current_totalInvestment')}:`} <Text style={{ fontSize: 20, fontWeight: 'bold' }}>{`$${formatMoney(totalInvestment)}`}</Text>
                    </Text>
                </View>
                {bannersViews}
            </Carousel>
        );
    }

    renderProducts() {
        const { products } = this.props;
        const { listsDesc, keyword, refreshing } = this.state;
        let products_ = keyword !== '' ? products.filter(v => v.token.toLowerCase().indexOf(keyword) >= 0 || v.tokenFullName.toLowerCase().indexOf(keyword) >= 0) : products;
        products_ = listsDesc ? products_.sort((a, b) => b.yearlyInterestRate - a.yearlyInterestRate) : products_.sort((a, b) => a.yearlyInterestRate - b.yearlyInterestRate);
        return products_.length ? (
            <FlatList
                data={products_}
                style={{ backgroundColor: mainBgColor }}
                keyExtractor={(item, index) => `${index}`}
                renderItem={({ item }) => {
                    const { token, tokenFullName, weeklyInterestRate, yearlyInterestRate, remainingQuota } = item;

                    return (
                        <TouchableOpacity onPress={() => this.toProductDetail(item)}>
                            <View style={styles.productContainer}>
                                <View style={styles.productHeader}>
                                    <Text style={{ fontSize: 12 }}>{`${token}/${tokenFullName}`}</Text>
                                    <Text style={{ fontSize: 12 }}>
                                        {strings('pokket.label_remaining_quote')}: {formatMoney(remainingQuota)}
                                    </Text>
                                </View>
                                <View style={styles.productBody}>
                                    <View style={styles.productLabel}>
                                        <Text>{`${BigNumber(yearlyInterestRate)
                                            .toNumber()
                                            .toFixed(4)}%`}</Text>
                                        <Text style={{ fontWeight: 'bold' }}>{strings('pokket.label_yearly_rate')}</Text>
                                    </View>
                                    <View style={styles.productLabel}>
                                        <Text>{`${BigNumber(weeklyInterestRate)
                                            .toNumber()
                                            .toFixed(4)}%`}</Text>
                                        <Text style={{ fontWeight: 'bold' }}>{strings('pokket.label_weekly_rate')}</Text>
                                    </View>
                                </View>
                            </View>
                        </TouchableOpacity>
                    );
                }}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={this.onRefresh} />}
            />
        ) : (
            <View
                style={{
                    flex: 1,
                    justifyContent: 'center',
                    alignItems: 'center',
                }}
            >
                <Image source={require('../../../../assets/empty_transactions.png')} style={{ width: 80, height: 80, tintColor: 'gray', marginBottom: 20 }} resizeMode="contain" />
                <Text style={{ color: 'gray' }}>{strings('pokket.label_no_products')}</Text>
            </View>
        );
    }

    renderContent() {
        const { keyword, focusedSearch, listsDesc } = this.state;
        return (
            <DismissKeyboardView>
                <View style={{ flex: 1, backgroundColor: mainBgColor, alignItems: 'center' }}>
                    {/* billboard */}
                    {this.renderBanners()}
                    {/* search bar */}
                    <View
                        style={{
                            ...commonStyles.shadow,
                            width,
                            paddingHorizontal: 20,
                            backgroundColor: '#fff',
                        }}
                    >
                        <View style={{ width, flexDirection: 'row', justifyContent: 'flex-start', alignItems: 'center' }}>
                            <Image source={require('../../../../assets/rectangle.png')} resizeMode="contain" style={{ width: 5, height: 30 }} />
                            <Animated.View
                                style={[
                                    styles.searchBar,
                                    {
                                        width: this.focusedAnimated.interpolate({
                                            inputRange: [0, 1],
                                            outputRange: [180, 250],
                                        }),
                                    },
                                ]}
                            >
                                <Image source={require('../../../../assets/icon_search.png')} resizeMode="contain" style={{ width: 20, height: 20, tintColor: mainColor }} />
                                <TextInput
                                    style={{ width: '100%', height: 30, padding: 0, marginLeft: 5 }}
                                    onFocus={() => this.toggle(true)}
                                    onBlur={() => this.toggle(false)}
                                    value={keyword}
                                    maxLength={10}
                                    multiline={false}
                                    placeholder={strings('pokket.placeholder_filter_by_token')}
                                    onChangeText={this.searchProduct}
                                />
                            </Animated.View>
                            <SortButton
                                onPress={() => {
                                    this.setState({
                                        listsDesc: !listsDesc,
                                    });
                                }}
                                style={{ marginLeft: 10 }}
                                title={focusedSearch ? '' : strings('pokket.label_rate')}
                                desc={listsDesc}
                            />
                        </View>
                    </View>
                    {/* products */}
                    {this.renderProducts()}
                    <Loading ref="refLoading" />
                </View>
            </DismissKeyboardView>
        );
    }

    renderNoNetWork() {
        return (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                <TouchableOpacity
                    style={{
                        ...commonStyles.shadow,
                        borderRadius: 10,
                        backgroundColor: 'white',
                        flex: 1,
                        width: width - 20,
                        marginVertical: 20,
                        marginHorizontal: 10,
                        alignItems: 'center',
                        justifyContent: 'center',
                    }}
                    onPress={() => {
                        this.setState(
                            {
                                isLoading: true,
                            },
                            () => this.checkNetWork(),
                        );
                    }}
                >
                    <Image source={require('../../../../assets/empty_under_construction.png')} style={{ width: 80, height: 80, tintColor: 'gray' }} resizeMode="contain" />
                    <Text style={{ color: 'gray', textAlign: 'center', marginTop: 20 }}>{strings('error_connect_remote_server')}</Text>
                </TouchableOpacity>
            </View>
        );
    }

    render() {
        const { isLoading, noNetwork, showMenu } = this.state;
        const popWindowTop = getStatusBarHeight(true) + Header.HEIGHT;
        return (
            <View style={{ flex: 1 }}>
                {isLoading ? this.renderLoading() : noNetwork ? this.renderNoNetWork() : this.renderContent()}
                {/* Menu Pop window */}
                <PopupMenu
                    backgroundColor="rgba(52,52,52,0.54)"
                    onClose={select => this.onCloseMenu(select)}
                    visible={showMenu}
                    data={POKKET_MENU}
                    containerPosition={{
                        position: 'absolute',
                        top: popWindowTop,
                        right: 5,
                    }}
                    imageStyle={{ width: 20, height: 20, marginRight: 10 }}
                    fontStyle={{ fontSize: 12, color: '#000' }}
                    itemStyle={{
                        flexDirection: 'row',
                        justifyContent: 'flex-start',
                        alignItems: 'center',
                        marginVertical: 10,
                    }}
                    containerBackgroundColor="#fff"
                    ItemSeparatorComponent={() => <View style={styles.divider} />}
                />
            </View>
        );
    }
}

const mapToState = ({ pokketModel }) => {
    return {
        products: Object.values(pokketModel.products),
        totalInvestment: pokketModel.totalInvestment,
        banners: pokketModel.banners,
    };
};

export default connect(mapToState)(PokketHome);

const styles = {
    billboardContainer: {
        height: 240,
        backgroundColor: 'black',
    },
    slide: {
        width,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'transparent',
    },
    productContainer: {
        ...commonStyles.shadow,
        marginHorizontal: 20,
        marginVertical: 10,
        borderRadius: 10,
        width: width - 40,
        backgroundColor: '#fff',
        padding: 10,
    },
    productHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderBottomWidth: 1 / PixelRatio.get(),
        borderColor: 'gray',
        paddingBottom: 10,
    },
    productBody: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
    },
    productLabel: {
        marginHorizontal: 10,
        paddingVertical: 10,
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    searchBar: {
        flexDirection: 'row',
        borderWidth: 1,
        borderColor: 'black',
        borderRadius: 5,
        alignItems: 'center',
        paddingHorizontal: 5,
        marginVertical: 10,
        marginLeft: 10,
    },
    divider: {
        height: 0.5,
        backgroundColor: '#dfdfdf',
    },
};
